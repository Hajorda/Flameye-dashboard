import logging
from datetime import datetime, timezone

import redis as redis_lib

logger = logging.getLogger(__name__)


def publish_frame(
    r: redis_lib.Redis,
    stream_key: str,
    camera_id: str,
    frame_bytes: bytes,
    max_len: int = 50,
) -> None:
    r.xadd(
        stream_key,
        {
            "frame": frame_bytes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "camera_id": camera_id,
        },
        maxlen=max_len,
        approximate=True,
    )
