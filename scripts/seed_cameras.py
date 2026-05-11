#!/usr/bin/env python3
"""
Insert or update test camera rows in the database.
Run after 'make up' once postgres is healthy.

Usage:
  DATABASE_URL=postgresql://wildfire:changeme@localhost:5432/wildfire python scripts/seed_cameras.py
"""
import os
import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://wildfire:changeme@localhost:5432/wildfire",
)

CAMERAS = [
    {
        "name": "Test Camera 1 (YouTube)",
        "rtsp_url": os.environ.get("STREAM_URL", "https://www.youtube.com/watch?v=hRDM3ir3l5M"),
        "latitude": 37.7749,
        "longitude": -122.4194,
        "location_label": "San Francisco Test Site",
    },
]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    for cam in CAMERAS:
        cur.execute(
            """
            INSERT INTO cameras (name, rtsp_url, latitude, longitude, location_label)
            VALUES (%(name)s, %(rtsp_url)s, %(latitude)s, %(longitude)s, %(location_label)s)
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            cam,
        )
        row = cur.fetchone()
        if row:
            print(f"  Inserted camera '{cam['name']}' → id={row[0]}")
        else:
            print(f"  Camera '{cam['name']}' already exists, skipped")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
