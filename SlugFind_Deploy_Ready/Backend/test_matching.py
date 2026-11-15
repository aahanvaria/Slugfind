
from matching import calculate_match

lost_item = {
    "category": "water bottle",
    "color": "blue",
    "brand": "Hydro Flask",
    "distinctive_features": [
        "white mountain sticker"
    ],
    "keywords": [
        "water bottle",
        "blue flask"
    ],
    "location": "McHenry Library",
    "event_time": "2026-11-14T13:00:00"
}

found_item = {
    "category": "water bottle",
    "color": "blue",
    "brand": None,
    "distinctive_features": [
        "white sticker with a mountain"
    ],
    "keywords": [
        "metal drinking bottle",
        "blue water flask"
    ],
    "location": "McHenry Library",
    "event_time": "2026-11-14T14:00:00"
}

result = calculate_match(lost_item, found_item)

print("SLUGFIND MATCHING TEST")
print("----------------------")
print("Match score:", result["score"], "/ 100")
print("Reasons:", result["reasons"])

assert result["score"] > 50

print("MATCHING TEST SUCCESSFUL!")
