import asyncio
import os

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from redis import asyncio as aioredis

router = APIRouter(tags=["feed"])

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
FEED_FPS = float(os.environ.get("FEED_FPS", "1.0"))  # frames per second to stream


async def _mjpeg_generator(camera_id: int):
    r = await aioredis.from_url(REDIS_URL)
    interval = 1.0 / max(FEED_FPS, 0.1)
    try:
        while True:
            messages = await r.xrevrange(f"frames:{camera_id}", count=1)
            if messages:
                _, data = messages[0]
                frame_bytes = data[b"frame"]
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + frame_bytes
                    + b"\r\n"
                )
            await asyncio.sleep(interval)
    finally:
        await r.aclose()


@router.get("/api/cameras/{camera_id}/feed")
async def camera_feed(camera_id: int):
    return StreamingResponse(
        _mjpeg_generator(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
