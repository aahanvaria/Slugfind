
from gemini_service import analyze_item

print("1. Starting SlugFind AI test...", flush=True)

description = (
    "I lost my blue Hydro Flask water bottle "
    "with a white mountain sticker."
)

print("2. Sending request to Gemini...", flush=True)

try:
    result = analyze_item(description)

    print("3. Gemini responded successfully!", flush=True)
    print("----------------------------")
    print("Category:", result["category"])
    print("Color:", result["color"])
    print("Brand:", result["brand"])
    print("Features:", result["distinctive_features"])
    print("Keywords:", result["keywords"])

except Exception as error:
    print("GEMINI ERROR:", repr(error), flush=True)
