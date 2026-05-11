import logging
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import cv2
import numpy as np

logger = logging.getLogger(__name__)

IMAGES_DIR = Path("/app/images")


async def cleanup_tmp_files() -> None:
    """Delete temp files left by a previous crash (no matching DB row exists)."""
    for f in IMAGES_DIR.glob("tmp_*"):
        f.unlink(missing_ok=True)
        logger.warning("Removed orphaned temp file: %s", f.name)


async def save_alert_atomically(
    db: asyncpg.Connection,
    camera_id: int,
    annotated_frame: np.ndarray,
    confidence: float,
    bbox: list[int],
    class_name: str = "fire",
) -> dict:
    """
    Write the annotated JPEG to disk and the alert row to PostgreSQL atomically.

    Order:
      1. Write to tmp_<uuid>.jpg
      2. INSERT inside a transaction → commit
      3. Rename tmp → final (atomic on Linux)

    If step 2 or 3 fails, the temp file is cleaned up and the exception re-raised.
    """
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc)
    tmp_path = IMAGES_DIR / f"tmp_{uuid.uuid4()}.jpg"
    final_name = f"{camera_id}_{ts.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
    final_path = IMAGES_DIR / final_name

    cv2.imwrite(str(tmp_path), annotated_frame)

    try:
        async with db.transaction():
            row = await db.fetchrow(
                """
                INSERT INTO alerts
                    (camera_id, confidence, image_filename, bbox_x, bbox_y, bbox_w, bbox_h, class_name, detected_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, detected_at
                """,
                camera_id,
                confidence,
                final_name,
                bbox[0],
                bbox[1],
                bbox[2] - bbox[0],  # width
                bbox[3] - bbox[1],  # height
                class_name,
                ts,
            )

        tmp_path.rename(final_path)
        logger.info("Alert saved — id=%s file=%s", row["id"], final_name)

        return {
            "id": row["id"],
            "camera_id": camera_id,
            "confidence": round(confidence, 4),
            "class_name": class_name,
            "image_filename": final_name,
            "detected_at": ts.isoformat(),
        }
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


async def cluster_alert(db: asyncpg.Pool, alert_id: int, camera_id: int, lat: float, lon: float, confidence: float) -> None:
    """
    Associate a new alert with an existing nearby incident, or create a new one.
    Uses Haversine SQL — no PostGIS required.
    """
    incident_id = await db.fetchval(
        """
        SELECT id FROM incidents
        WHERE status = 'active'
          AND last_activity_at > NOW() - INTERVAL '2 hours'
          AND 2 * 6371 * asin(sqrt(
                power(sin(radians((latitude  - $1) / 2)), 2) +
                cos(radians($1)) * cos(radians(latitude)) *
                power(sin(radians((longitude - $2) / 2)), 2)
              )) < 5
        ORDER BY last_activity_at DESC
        LIMIT 1
        """,
        lat, lon,
    )

    if incident_id:
        await db.execute(
            """
            UPDATE incidents
            SET last_activity_at = NOW(),
                alert_count = alert_count + 1,
                max_confidence = GREATEST(max_confidence, $2)
            WHERE id = $1
            """,
            incident_id, confidence,
        )
    else:
        incident_id = await db.fetchval(
            """
            INSERT INTO incidents
                (first_alert_id, first_camera_id, latitude, longitude,
                 started_at, last_activity_at, alert_count, max_confidence)
            VALUES ($1, $2, $3, $4, NOW(), NOW(), 1, $5)
            RETURNING id
            """,
            alert_id, camera_id, lat, lon, confidence,
        )

    await db.execute(
        "UPDATE alerts SET incident_id = $1 WHERE id = $2",
        incident_id, alert_id,
    )
    logger.info("Alert %d → incident %d", alert_id, incident_id)
