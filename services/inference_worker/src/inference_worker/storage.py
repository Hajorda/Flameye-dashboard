import logging
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
