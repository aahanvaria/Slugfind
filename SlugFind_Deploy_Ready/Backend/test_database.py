
from database import (
    initialize_database,
    add_item,
    get_all_items,
    get_item_by_id
)

print("1. Initializing database...")
initialize_database()

test_item = {
    "item_type": "lost",
    "description": "Blue Hydro Flask with white sticker",
    "location": "McHenry Library",
    "event_time": "2026-11-14T13:00:00",
    "category": "water bottle",
    "color": "blue",
    "brand": "Hydro Flask",
    "distinctive_features": ["white mountain sticker"],
    "keywords": ["water bottle", "blue flask"]
}

print("2. Saving test item...")

item_id = add_item(test_item)

print("3. Item saved with ID:", item_id)

saved_item = get_item_by_id(item_id)

print("4. Retrieved item:", saved_item)

assert saved_item is not None
assert saved_item["description"] == test_item["description"]

print("DATABASE TEST SUCCESSFUL!")
