"""SlugFind claim requests: isolated add-on for existing FastAPI app.

Attach with `from claims import router as claims_router` and
`app.include_router(claims_router)` after creating `app` in main.py.
"""
import os
import re
import secrets
import sqlite3
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from database import DB_PATH, get_item_by_id

router = APIRouter()
_initialize_lock = Lock()
_initialized = False


def _connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def _ensure_schema():
    global _initialized
    if _initialized:
        return
    with _initialize_lock:
        if _initialized:
            return
        with _connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS claim_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER NOT NULL,
                    request_type TEXT NOT NULL CHECK(request_type IN ('claim','information')),
                    contact_email TEXT NOT NULL,
                    private_detail TEXT NOT NULL,
                    additional_context TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','approved','rejected')),
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    reviewed_at TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS claim_item_idx ON claim_requests(item_id)")
        _initialized = True


class ClaimSubmission(BaseModel):
    item_id: int = Field(gt=0)
    contact_email: str = Field(min_length=3, max_length=254)
    private_detail: str = Field(min_length=12, max_length=500)
    additional_context: str = Field(default="", max_length=300)


class ClaimDecision(BaseModel):
    status: str


def _admin_only(x_admin_key: str | None = Header(default=None)):
    expected = os.getenv("SLUGFIND_ADMIN_KEY", "")
    if not expected or not x_admin_key or not secrets.compare_digest(expected, x_admin_key):
        raise HTTPException(403, "Admin access denied")


@router.post("/api/claims", status_code=201)
def create_claim(payload: ClaimSubmission):
    item = get_item_by_id(payload.item_id)
    if item is None:
        raise HTTPException(404, "Item report not found")
    if item.get("status", "active") != "active":
        raise HTTPException(409, "This report is not accepting requests")
    email = payload.contact_email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Enter a valid contact email")
    detail = payload.private_detail.strip()
    if len(detail) < 12:
        raise HTTPException(422, "Please include at least 12 characters of identifying information")
    _ensure_schema()
    request_type = "claim" if item["item_type"] == "found" else "information"
    with _connect() as conn:
        cursor = conn.execute("""
            INSERT INTO claim_requests
                (item_id, request_type, contact_email, private_detail, additional_context)
            VALUES (?, ?, ?, ?, ?)
        """, (payload.item_id, request_type, email, detail, payload.additional_context.strip()))
        claim_id = cursor.lastrowid
    return {"id": claim_id, "status": "pending", "message": "Request received for manual review"}


@router.get("/api/admin/claims", dependencies=[Depends(_admin_only)])
def list_claims(status: str | None = None):
    if status is not None and status not in ("pending", "approved", "rejected"):
        raise HTTPException(400, "Invalid status")
    _ensure_schema()
    with _connect() as conn:
        if status:
            rows = conn.execute("SELECT * FROM claim_requests WHERE status = ? ORDER BY id DESC", (status,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM claim_requests ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


@router.patch("/api/admin/claims/{claim_id}", dependencies=[Depends(_admin_only)])
def review_claim(claim_id: int, decision: ClaimDecision):
    if decision.status not in ("approved", "rejected"):
        raise HTTPException(400, "Status must be approved or rejected")
    _ensure_schema()
    with _connect() as conn:
        updated = conn.execute("""
            UPDATE claim_requests SET status = ?, reviewed_at = datetime('now')
            WHERE id = ? AND status = 'pending'
        """, (decision.status, claim_id)).rowcount
    if not updated:
        raise HTTPException(404, "Pending request not found")
    return {"id": claim_id, "status": decision.status}
