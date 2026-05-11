#!/usr/bin/env python3
"""
Manual cleanup of orphaned tmp_* files in the images directory.
These are left behind when the inference_worker crashes mid-write.
The worker auto-runs this on startup, but this script lets you do it manually.

Usage:
  python scripts/cleanup_tmp.py
  IMAGES_DIR=/custom/path python scripts/cleanup_tmp.py
"""
import os
from pathlib import Path

IMAGES_DIR = Path(os.environ.get("IMAGES_DIR", "images"))


def main():
    if not IMAGES_DIR.exists():
        print(f"Directory not found: {IMAGES_DIR}")
        return

    tmp_files = list(IMAGES_DIR.glob("tmp_*"))
    if not tmp_files:
        print("No orphaned temp files found.")
        return

    for f in tmp_files:
        f.unlink()
        print(f"Removed: {f.name}")

    print(f"\nCleaned {len(tmp_files)} file(s).")


if __name__ == "__main__":
    main()
