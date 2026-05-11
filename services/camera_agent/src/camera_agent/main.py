import json
import logging
import os
import sys
import threading
import time

import cv2
import psycopg2
import psycopg2.extras
import redis

from .capture import open_capture, resolve_stream_url
from .publisher import publish_frame

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [camera_agent] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.environ["DATABASE_URL"]
FRAME_INTERVAL = float(os.environ.get("FRAME_INTERVAL", "2.0"))
JPEG_QUALITY = int(os.environ.get("JPEG_QUALITY", "85"))
STREAM_MAX_LEN = int(os.environ.get("STREAM_MAX_LEN", "50"))
YOUTUBE_REFRESH_FRAMES = int(os.environ.get("YOUTUBE_REFRESH_FRAMES", "1800"))
HEARTBEAT_INTERVAL = int(os.environ.get("HEARTBEAT_INTERVAL", "5"))
CAMERA_POLL_INTERVAL = int(os.environ.get("CAMERA_POLL_INTERVAL", "30"))  # re-check DB every N seconds


def _is_youtube(url: str) -> bool:
    return "youtube.com" in url or "youtu.be" in url


def _open_stream(url: str) -> cv2.VideoCapture:
    resolved = resolve_stream_url(url) if _is_youtube(url) else url
    return open_capture(resolved)


def _publish_status(r: redis.Redis, camera_id: int, state: str, frames: int, error: str = "") -> None:
    payload = {
        "camera_id": camera_id,
        "state": state,
        "frames_published": frames,
        "error": error,
        "ts": time.time(),
    }
    r.set(f"camera:{camera_id}:status", json.dumps(payload), ex=30)
    r.publish("camera_status", json.dumps(payload))


def _fetch_active_cameras(db_url: str) -> list[dict]:
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, name, rtsp_url FROM cameras WHERE active = TRUE ORDER BY id")
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _run_camera(cam: dict, r: redis.Redis) -> None:
    """Capture loop for a single camera — runs in its own thread."""
    cam_id: int = cam["id"]
    name: str = cam["name"]
    url: str = cam["rtsp_url"]
    stream_key = f"frames:{cam_id}"
    is_yt = _is_youtube(url)

    logger.info("Starting capture for camera %d (%s)", cam_id, name)
    _publish_status(r, cam_id, "connecting", 0)

    try:
        cap = _open_stream(url)
    except Exception as exc:
        logger.error("Camera %d: failed to open stream — %s", cam_id, exc)
        _publish_status(r, cam_id, "error", 0, str(exc))
        return

    logger.info("Camera %d: stream opened", cam_id)
    _publish_status(r, cam_id, "streaming", 0)

    frame_count = 0
    last_heartbeat = time.time()

    while True:
        if is_yt and frame_count > 0 and frame_count % YOUTUBE_REFRESH_FRAMES == 0:
            logger.info("Camera %d: refreshing YouTube URL", cam_id)
            _publish_status(r, cam_id, "reconnecting", frame_count)
            cap.release()
            try:
                cap = _open_stream(url)
                _publish_status(r, cam_id, "streaming", frame_count)
            except Exception as exc:
                logger.error("Camera %d: refresh failed — %s", cam_id, exc)
                _publish_status(r, cam_id, "error", frame_count, str(exc))
                time.sleep(10)
                continue

        ret, frame = cap.read()
        if not ret:
            logger.warning("Camera %d: frame read failed — reconnecting in 5s", cam_id)
            _publish_status(r, cam_id, "reconnecting", frame_count)
            cap.release()
            time.sleep(5)
            try:
                cap = _open_stream(url)
                _publish_status(r, cam_id, "streaming", frame_count)
            except Exception as exc:
                logger.error("Camera %d: reconnect failed — %s", cam_id, exc)
                _publish_status(r, cam_id, "error", frame_count, str(exc))
                time.sleep(10)
            continue

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        publish_frame(r, stream_key, str(cam_id), buf.tobytes(), STREAM_MAX_LEN)

        frame_count += 1
        if frame_count % 100 == 0:
            logger.info("Camera %d: published %d frames", cam_id, frame_count)

        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            _publish_status(r, cam_id, "streaming", frame_count)
            last_heartbeat = now

        time.sleep(FRAME_INTERVAL)


def main() -> None:
    r = redis.from_url(REDIS_URL, socket_connect_timeout=5, socket_timeout=5)
    r.ping()
    logger.info("Redis connected")

    active_threads: dict[int, threading.Thread] = {}

    while True:
        try:
            cameras = _fetch_active_cameras(DATABASE_URL)
        except Exception as exc:
            logger.error("DB query failed: %s — retrying in 10s", exc)
            time.sleep(10)
            continue

        current_ids = {c["id"] for c in cameras}
        running_ids = set(active_threads.keys())

        # Start threads for newly active cameras
        for cam in cameras:
            cam_id = cam["id"]
            if cam_id not in running_ids or not active_threads[cam_id].is_alive():
                t = threading.Thread(
                    target=_run_camera,
                    args=(cam, r),
                    name=f"camera-{cam_id}",
                    daemon=True,
                )
                t.start()
                active_threads[cam_id] = t
                logger.info("Launched thread for camera %d", cam_id)

        # Mark cameras removed from active set as offline
        for cam_id in running_ids - current_ids:
            logger.info("Camera %d deactivated — marking offline", cam_id)
            _publish_status(r, cam_id, "offline", 0)
            del active_threads[cam_id]

        time.sleep(CAMERA_POLL_INTERVAL)
