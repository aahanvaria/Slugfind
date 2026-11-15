
import sqlite3
import json
import os
from pathlib import Path

# Store database inside the Backend folder
DB_PATH = Path(os.getenv("SLUGFIND_DB_PATH", str(Path(__file__).parent / "slugfind.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


# Create or update database
def initialize_database():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL
                    CHECK(item_type IN ('lost', 'found')),
                title TEXT,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                event_time TEXT NOT NULL,
                category TEXT,
                color TEXT,
                brand TEXT,
                distinctive_features TEXT,
                keywords TEXT,
                status TEXT DEFAULT 'active',
                image_url TEXT
            )
        """)

        columns = {
            row[1]
            for row in conn.execute("PRAGMA table_info(items)")
        }

        if "image_url" not in columns:
            conn.execute(
                "ALTER TABLE items ADD COLUMN image_url TEXT"
            )

        if "title" not in columns:
            conn.execute(
                "ALTER TABLE items ADD COLUMN title TEXT"
            )

# Save a lost or found item
def add_item(item):
    with get_connection() as conn:
        cursor = conn.execute("""
    INSERT INTO items (
        item_type, title, description, location,
        event_time, category, color, brand,
        distinctive_features, keywords, image_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    item["item_type"],
    item.get("title"),
    item["description"],
    item["location"],
    item["event_time"],
    item.get("category"),
    item.get("color"),
    item.get("brand"),
    json.dumps(item.get("distinctive_features", [])),
    json.dumps(item.get("keywords", [])),
    item.get("image_url")
))

        return cursor.lastrowid


# Retrieve all saved items
def get_all_items():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM items ORDER BY id DESC"
        ).fetchall()

    items = []

    for row in rows:
        item = dict(row)

        item["distinctive_features"] = json.loads(
            item["distinctive_features"] or "[]"
        )

        item["keywords"] = json.loads(
            item["keywords"] or "[]"
        )

        items.append(item)

    return items


# Retrieve one item by ID
def get_item_by_id(item_id):
    for item in get_all_items():
        if item["id"] == item_id:
            return item

    return None
