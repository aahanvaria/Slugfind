import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import (
    add_item,
    get_all_items,
    get_item_by_id,
    initialize_database,
)
from gemini_service import analyze_item
from matching import find_matches

UPLOAD_DIR = Path(os.getenv("SLUGFIND_UPLOAD_DIR", str(Path(__file__).parent / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_IMAGE_SIZE = 5_000_000
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}





@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="SlugFind Backend", lifespan=lifespan)

# Development CORS: the React page may be opened on another device on the LAN.
# Restrict this list to known frontend origins before deploying publicly.

# Set FRONTEND_ORIGIN to your public static-site URL (no trailing slash).
# Keep local Vite origins enabled for development.
public_origin = os.getenv("FRONTEND_ORIGIN", "").rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[public_origin] if public_origin else [],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):517[0-9]",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


async def read_image(image: UploadFile | None):
    if image is None or not image.filename:
        return None, None

    mime_type = image.content_type
    if mime_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG and WebP images are allowed",
        )

    image_bytes = await image.read(MAX_IMAGE_SIZE + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds 5 MB")

    valid = (
        (mime_type == "image/jpeg" and image_bytes.startswith(b"\xff\xd8\xff"))
        or (mime_type == "image/png" and image_bytes.startswith(b"\x89PNG\r\n\x1a\n"))
        or (
            mime_type == "image/webp"
            and len(image_bytes) >= 12
            and image_bytes[:4] == b"RIFF"
            and image_bytes[8:12] == b"WEBP"
        )
    )
    if not valid:
        raise HTTPException(
            status_code=400,
            detail="File contents do not match the image format",
        )

    return image_bytes, mime_type


def save_image(image_bytes: bytes, mime_type: str):
    extension = ALLOWED_IMAGE_TYPES[mime_type]
    filename = f"{uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(image_bytes)
    return f"/uploads/{filename}"


@app.get("/")
def home():
    return {"message": "SlugFind backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    description: str = Form(""),
    image: UploadFile | None = File(None),
):
    image_bytes, mime_type = await read_image(image)
    if not description.strip() and not image_bytes:
        raise HTTPException(status_code=400, detail="Provide a description or image")

    try:
        result = analyze_item(description, image_bytes, mime_type)
        return {"success": True, "analysis": result}
    except Exception as error:
        print("Gemini analysis error:", repr(error))
        raise HTTPException(status_code=502, detail="Gemini analysis is unavailable")


@app.post("/api/items")
async def create_item(
    item_type: str = Form(...),
    title: str = Form(""),
    description: str = Form(""),
    location: str = Form(...),
    event_time: str = Form(...),
    category: str = Form("Other"),
    image: UploadFile | None = File(None),
):
    if item_type not in ("lost", "found"):
        raise HTTPException(status_code=400, detail="Item type must be lost or found")

    try:
        datetime.fromisoformat(event_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date/time format")

    if not title.strip():
        raise HTTPException(status_code=400, detail="Item name is required")

    image_bytes, mime_type = await read_image(image)
    if not description.strip() and not image_bytes:
        raise HTTPException(status_code=400, detail="Provide a description or image")

    # Gemini enriches reports, but an AI outage should not prevent a student
    # from reporting a lost or found item.
    analysis = {}
    try:
        analysis = analyze_item(
            f"Item name: {title.strip()}\nDescription: {description.strip()}",
            image_bytes,
            mime_type,
        ) or {}
    except Exception as error:
        print("Gemini analysis unavailable; saving report without AI attributes:", repr(error))

    image_url = save_image(image_bytes, mime_type) if image_bytes else None
    item = {
        "item_type": item_type,
        "title": title.strip(),
        "description": description.strip() or title.strip(),
        "location": location,
        "event_time": event_time,
        "category": category or analysis.get("category") or "Other",
        "color": analysis.get("color"),
        "brand": analysis.get("brand"),
        "distinctive_features": analysis.get("distinctive_features", []),
        "keywords": analysis.get("keywords", []),
        "image_url": image_url,
    }

    try:
        item_id = add_item(item)
    except Exception as error:
        if image_url:
            (UPLOAD_DIR / Path(image_url).name).unlink(missing_ok=True)
        print("Database save error:", repr(error))
        raise HTTPException(status_code=500, detail="Could not save the report")

    saved_item = get_item_by_id(item_id)
    if saved_item is None:
        raise HTTPException(status_code=500, detail="Report saved but could not be retrieved")
    return saved_item


@app.get("/api/items")
def list_items():
    return get_all_items()


@app.get("/api/matches/{item_id}")
def get_matches(item_id: int):
    target = get_item_by_id(item_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Item not found or expired")

    matches = find_matches(target, get_all_items())
    return {"item_id": item_id, "matches": matches}

from claims import router as claims_router
app.include_router(claims_router)
