#!/usr/bin/env python3
"""
Step 1 smoke test — no Docker required.
Verifies that OpenCV can open the stream (RTSP or YouTube) and
optionally runs YOLO on the first N frames.

Usage:
  STREAM_URL=https://youtu.be/xxxxx python scripts/test_stream.py
  STREAM_URL=rtsp://192.168.1.64/stream MODEL_PATH=models/fire_model.pt python scripts/test_stream.py
"""
import os
import sys
import time

import cv2
import numpy as np

STREAM_URL = os.environ.get("STREAM_URL", "")
MODEL_PATH = os.environ.get("MODEL_PATH", "")
FRAMES_TO_TEST = int(os.environ.get("FRAMES_TO_TEST", "5"))

if not STREAM_URL:
    print("ERROR: Set STREAM_URL environment variable")
    sys.exit(1)


def resolve_url(url: str) -> str:
    if "youtube.com" in url or "youtu.be" in url:
        print("Resolving YouTube URL via yt-dlp...")
        try:
            import yt_dlp
            with yt_dlp.YoutubeDL({"format": "best[ext=mp4]/best", "quiet": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                direct = info.get("url") or info["formats"][-1]["url"]
                print(f"  → Resolved to direct stream URL (length={len(direct)})")
                return direct
        except Exception as e:
            print(f"ERROR: yt-dlp failed: {e}")
            sys.exit(1)
    return url


def main():
    url = resolve_url(STREAM_URL)

    print(f"\nOpening stream with OpenCV...")
    cap = cv2.VideoCapture(url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("ERROR: Could not open stream")
        sys.exit(1)

    print(f"  Width : {cap.get(cv2.CAP_PROP_FRAME_WIDTH):.0f}")
    print(f"  Height: {cap.get(cv2.CAP_PROP_FRAME_HEIGHT):.0f}")
    print(f"  FPS   : {cap.get(cv2.CAP_PROP_FPS):.1f}")

    model = None
    if MODEL_PATH:
        print(f"\nLoading YOLO model: {MODEL_PATH}")
        try:
            from ultralytics import YOLO
            model = YOLO(MODEL_PATH)
            print("  Model loaded OK")
        except Exception as e:
            print(f"  WARNING: Could not load model: {e}")

    print(f"\nReading {FRAMES_TO_TEST} frames...\n")
    for i in range(FRAMES_TO_TEST):
        ret, frame = cap.read()
        if not ret:
            print(f"  Frame {i+1}: FAILED to read")
            continue

        h, w = frame.shape[:2]
        print(f"  Frame {i+1}: {w}x{h} ✓", end="")

        if model is not None:
            t0 = time.perf_counter()
            results = model(frame, conf=0.25, verbose=False)
            ms = (time.perf_counter() - t0) * 1000
            boxes = results[0].boxes
            n = len(boxes)
            print(f"  |  YOLO: {n} detections in {ms:.1f}ms", end="")
            for box in boxes:
                cls_id = int(box.cls[0])
                cls_name = results[0].names[cls_id]
                conf = float(box.conf[0])
                print(f"  [{cls_name} {conf:.2f}]", end="")

        print()

    cap.release()
    print("\nSmoke test complete.")


if __name__ == "__main__":
    main()
