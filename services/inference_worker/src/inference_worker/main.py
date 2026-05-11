import asyncio
import json
import logging
import os
import sys

import asyncpg
import redis as redis_lib

from .confirmation import ConfirmationBuffer
from .consumer import ack_frame, ensure_consumer_group, read_next_frame
from .detector import FireDetector
from .motion import has_motion
from .notify import send_telegram_alert
from .storage import cleanup_tmp_files, cluster_alert, save_alert_atomically

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [inference_worker] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

REDIS_URL = os.environ["REDIS_URL"]
DATABASE_URL = os.environ["DATABASE_URL"]
MODEL_PATH = os.environ.get("MODEL_PATH", "/models/fire_model.pt")
CONFIDENCE = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.5"))
CONSUMER_ID = os.environ.get("CONSUMER_ID", "worker_1")
ALERT_COOLDOWN = int(os.environ.get("ALERT_COOLDOWN_SECONDS", "600"))
MOTION_THRESHOLD = float(os.environ.get("MOTION_THRESHOLD", "1.5"))
CAMERA_POLL_INTERVAL = int(os.environ.get("CAMERA_POLL_INTERVAL", "30"))
ALERT_CLASSES: set[str] = set(
    c.strip() for c in os.environ.get("ALERT_CLASSES", "fire,smoke,other").split(",")
)


async def _fetch_active_cameras(db: asyncpg.Pool) -> list[dict]:
    rows = await db.fetch("SELECT id, name, latitude, longitude FROM cameras WHERE active = TRUE ORDER BY id")
    return [{"id": r["id"], "name": r["name"], "latitude": r["latitude"], "longitude": r["longitude"]} for r in rows]


async def run_camera(
    camera: dict,
    db: asyncpg.Pool,
    r: redis_lib.Redis,
    detector: FireDetector,
    stop_event: asyncio.Event,
) -> None:
    camera_id: int = camera["id"]
    cam_lat: float = camera.get("latitude", 0.0)
    cam_lon: float = camera.get("longitude", 0.0)
    stream_key = f"frames:{camera_id}"
    last_alert_key = f"last_alert:{camera_id}"

    ensure_consumer_group(r, stream_key)
    confirmation = ConfirmationBuffer(window=5, threshold=3)
    prev_frame = None
    frames_processed = 0

    logger.info("Camera %d: inference started on stream '%s'", camera_id, stream_key)

    while not stop_event.is_set():
        msg_id, frame, _ = await asyncio.to_thread(
            read_next_frame, r, stream_key, CONSUMER_ID
        )

        if frame is None:
            continue

        if not has_motion(prev_frame, frame, threshold=MOTION_THRESHOLD):
            await asyncio.to_thread(ack_frame, r, stream_key, msg_id)
            prev_frame = frame
            continue

        prev_frame = frame

        detections = await asyncio.to_thread(detector.predict, frame)
        triggering = [d for d in detections if d.get("class_name", "fire") in ALERT_CLASSES]
        best = max(triggering, key=lambda d: d["confidence"]) if triggering else None
        detected = best is not None

        should_alert = confirmation.update(camera_id, detected)
        frames_processed += 1

        if frames_processed % 50 == 0:
            logger.info("Camera %d: processed %d motion frames", camera_id, frames_processed)

        if should_alert and detected:
            if await asyncio.to_thread(r.get, last_alert_key):
                await asyncio.to_thread(ack_frame, r, stream_key, msg_id)
                continue

            annotated = await asyncio.to_thread(detector.annotate, frame, detections)
            alert = await save_alert_atomically(
                db, camera_id, annotated,
                best["confidence"], best["bbox"],
                class_name=best.get("class_name", "fire"),
            )

            # Cluster into incident (best-effort, don't fail alert on error)
            try:
                await cluster_alert(db, alert["id"], camera_id, cam_lat, cam_lon, best["confidence"])
            except Exception as exc:
                logger.warning("Incident clustering failed for alert %d: %s", alert["id"], exc)

            await asyncio.to_thread(r.setex, last_alert_key, ALERT_COOLDOWN, "1")
            await asyncio.to_thread(r.publish, "alerts", json.dumps(alert))

            logger.warning(
                "%s DETECTED — camera=%d conf=%.2f file=%s",
                best.get("class_name", "fire").upper(),
                camera_id, best["confidence"], alert["image_filename"],
            )

            asyncio.create_task(
                send_telegram_alert(
                    f"Camera {camera_id}",
                    best["confidence"],
                    f"/app/images/{alert['image_filename']}",
                )
            )

        await asyncio.to_thread(ack_frame, r, stream_key, msg_id)

    logger.info("Camera %d: inference stopped", camera_id)


async def run() -> None:
    r = redis_lib.from_url(REDIS_URL, socket_connect_timeout=5, socket_timeout=10)
    r.ping()
    logger.info("Redis connected")

    db = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    logger.info("PostgreSQL pool ready")

    await cleanup_tmp_files()

    try:
        detector = FireDetector(MODEL_PATH, CONFIDENCE)
    except FileNotFoundError as exc:
        logger.error("%s", exc)
        sys.exit(1)

    # camera_id → (task, stop_event)
    running: dict[int, tuple[asyncio.Task, asyncio.Event]] = {}

    while True:
        try:
            cameras = await _fetch_active_cameras(db)
        except Exception as exc:
            logger.error("DB query failed: %s", exc)
            await asyncio.sleep(10)
            continue

        current_ids = {c["id"] for c in cameras}
        running_ids = set(running.keys())

        # Start new cameras
        for cam in cameras:
            cid = cam["id"]
            if cid not in running_ids or running[cid][0].done():
                stop_evt = asyncio.Event()
                task = asyncio.create_task(
                    run_camera(cam, db, r, detector, stop_evt),
                    name=f"camera-{cid}",
                )
                running[cid] = (task, stop_evt)
                logger.info("Launched inference task for camera %d", cid)

        # Stop deactivated cameras
        for cid in running_ids - current_ids:
            task, stop_evt = running.pop(cid)
            stop_evt.set()
            logger.info("Stopped inference task for camera %d", cid)

        await asyncio.sleep(CAMERA_POLL_INTERVAL)


def main_sync() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main_sync()
