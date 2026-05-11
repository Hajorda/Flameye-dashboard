import logging

import cv2
import numpy as np
import redis as redis_lib

logger = logging.getLogger(__name__)

GROUP_NAME = "inference_workers"


def ensure_consumer_group(r: redis_lib.Redis, stream_key: str) -> None:
    try:
        r.xgroup_create(stream_key, GROUP_NAME, id="0", mkstream=True)
        logger.info("Consumer group '%s' created on '%s'", GROUP_NAME, stream_key)
    except redis_lib.exceptions.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def read_next_frame(
    r: redis_lib.Redis,
    stream_key: str,
    consumer_id: str,
    block_ms: int = 2000,
) -> tuple[str | None, np.ndarray | None, str | None]:
    """
    Block up to block_ms ms waiting for a frame.
    Returns (msg_id, frame_ndarray, iso_timestamp) or (None, None, None).
    """
    messages = r.xreadgroup(
        GROUP_NAME,
        consumer_id,
        {stream_key: ">"},
        count=1,
        block=block_ms,
    )
    if not messages:
        return None, None, None

    _, entries = messages[0]
    msg_id, data = entries[0]

    frame = cv2.imdecode(
        np.frombuffer(data[b"frame"], np.uint8),
        cv2.IMREAD_COLOR,
    )
    timestamp = data[b"timestamp"].decode()
    return msg_id, frame, timestamp


def ack_frame(r: redis_lib.Redis, stream_key: str, msg_id: str) -> None:
    r.xack(stream_key, GROUP_NAME, msg_id)
