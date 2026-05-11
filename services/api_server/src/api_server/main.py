import asyncio
import logging
import os
import sys

from redis import asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db.connection import create_pool
from .redis_listener import listen
from .firms import run_firms_poller
from .routers.alerts import router as alerts_router
from .routers.cameras import router as cameras_router
from .routers.elevation import router as elevation_router
from .routers.feed import router as feed_router
from .routers.health import router as health_router
from .routers.hotspots import router as hotspots_router
from .routers.incidents import router as incidents_router
from .routers.perimeters import router as perimeters_router
from .routers.reports import router as reports_router
from .routers.spread import router as spread_router
from .routers.weather import router as weather_router
from .ws.manager import ConnectionManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [api_server] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

app = FastAPI(title="Flameye API", version="0.1.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ws_manager = ConnectionManager()

app.include_router(alerts_router)
app.include_router(cameras_router)
app.include_router(elevation_router)
app.include_router(feed_router)
app.include_router(health_router)
app.include_router(hotspots_router)
app.include_router(incidents_router)
app.include_router(perimeters_router)
app.include_router(reports_router)
app.include_router(spread_router)
app.include_router(weather_router)


@app.on_event("startup")
async def startup() -> None:
    app.state.db = await create_pool()
    app.state.redis = aioredis.from_url(REDIS_URL)
    asyncio.create_task(listen(REDIS_URL, ["alerts", "camera_status"], ws_manager.broadcast))
    asyncio.create_task(run_firms_poller(app.state.db))
    logger.info("API server ready — docs at /api/docs")


@app.on_event("shutdown")
async def shutdown() -> None:
    await app.state.db.close()
    await app.state.redis.close()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# Static mounts — only active when directories exist (populated at build time)
if os.path.isdir("/app/images"):
    app.mount("/images", StaticFiles(directory="/app/images"), name="images")

if os.path.isdir("/app/dashboard/dist"):
    app.mount("/", StaticFiles(directory="/app/dashboard/dist", html=True), name="dashboard")


def serve() -> None:
    import uvicorn

    uvicorn.run(
        "api_server.main:app",
        host=os.environ.get("API_HOST", "0.0.0.0"),
        port=int(os.environ.get("API_PORT", "8000")),
        reload=False,
    )
