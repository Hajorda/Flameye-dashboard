import asyncio
import logging
from collections.abc import Awaitable, Callable

from redis import asyncio as aioredis

logger = logging.getLogger(__name__)


async def listen(
    redis_url: str,
    channels: list[str],
    on_message: Callable[[str], Awaitable[None]],
) -> None:
    """Subscribe to one or more Redis Pub/Sub channels and call on_message for each event.
    Uses polling instead of async-generator iteration to avoid redis-py aclose() bug.
    Reconnects automatically on error."""
    while True:
        r: aioredis.Redis | None = None
        try:
            r = aioredis.from_url(redis_url)
            pubsub = r.pubsub()
            await pubsub.subscribe(*channels)
            logger.info("Subscribed to Redis channels %s", channels)
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    data = message["data"]
                    await on_message(data.decode() if isinstance(data, bytes) else data)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Redis listener error: %s — reconnecting in 3s", exc)
            await asyncio.sleep(3)
        finally:
            if r is not None:
                await r.aclose()
