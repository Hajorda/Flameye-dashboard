import time

from fastapi import APIRouter, Request

from ..db.queries import get_health_stats

router = APIRouter(tags=["health"])
_start_time = time.time()


@router.get("/health")
async def health(request: Request):
    try:
        stats = await get_health_stats(request.app.state.db)
        db_ok = True
    except Exception:
        stats = None
        db_ok = False

    try:
        await request.app.state.redis.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "uptime_seconds": int(time.time() - _start_time),
        "db": db_ok,
        "redis": redis_ok,
        "alerts_today": stats["alerts_today"] if stats else 0,
        "unacknowledged": stats["unacknowledged"] if stats else 0,
    }
