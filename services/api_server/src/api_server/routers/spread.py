"""
Fire spread endpoint — computes Rothermel isochrone polygons for a given alert.
"""

import logging
import os

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..fire_spread import fuel_models as fm
from ..fire_spread.isochrone import compute_isochrones
from ..geo.elevation import get_slope_aspect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/spread", tags=["spread"])

OWM_API_KEY = os.environ.get("OPENWEATHERMAP_API_KEY", "")
OWM_BASE = "https://api.openweathermap.org/data/2.5/weather"

# LANDFIRE REST (US only, optional)
_LANDFIRE_URL = (
    "https://landfire.cr.usgs.gov/arcgis/rest/services/Landfire/US_220/MapServer/50/query"
    "?geometry={lon},{lat}&geometryType=esriGeometryPoint&inSR=4326"
    "&spatialRel=esriSpatialRelIntersects&outFields=FBFM40&f=json"
)


class SpreadRequest(BaseModel):
    camera_id: int
    alert_id: int | None = None
    moisture_pct: float = 8.0          # fine-fuel moisture %
    times_min: list[int] = [30, 60, 120]


async def _get_weather(lat: float, lon: float) -> tuple[float, float]:
    """Returns (wind_speed_mps, wind_deg). Falls back to calm if OWM unavailable."""
    if not OWM_API_KEY:
        return 3.0, 225.0  # light SW wind default

    url = f"{OWM_BASE}?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            d = resp.json()
            return d["wind"]["speed"], d["wind"].get("deg", 0)
    except Exception as exc:
        logger.warning("OWM fetch failed: %s", exc)
    return 3.0, 225.0


async def _get_fuel_model(lat: float, lon: float, redis) -> fm.FuelModel:
    """Query LANDFIRE for fuel model at location, with Redis cache. Falls back to GR2."""
    key = f"geo:fuel:{lat:.3f}:{lon:.3f}"
    cached = await redis.get(key)
    if cached:
        return fm.get(cached.decode())

    try:
        url = _LANDFIRE_URL.format(lat=lat, lon=lon)
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                code = features[0].get("attributes", {}).get("FBFM40")
                if code:
                    model = fm.from_landfire_code(int(code))
                    await redis.setex(key, 86400, model.name)
                    return model
    except Exception as exc:
        logger.warning("LANDFIRE fetch failed: %s", exc)

    await redis.setex(key, 86400, fm.DEFAULT_FUEL_MODEL)
    return fm.get(fm.DEFAULT_FUEL_MODEL)


@router.post("")
async def compute_spread(payload: SpreadRequest, request: Request):
    db = request.app.state.db
    redis = request.app.state.redis

    # Fetch camera location
    cam = await db.fetchrow(
        "SELECT latitude, longitude FROM cameras WHERE id = $1", payload.camera_id
    )
    if not cam:
        raise HTTPException(404, "Camera not found")

    lat, lon = cam["latitude"], cam["longitude"]
    moisture = payload.moisture_pct / 100.0

    # Fetch inputs concurrently
    import asyncio
    (wind_speed, wind_deg), (slope_deg, aspect_deg), fuel = await asyncio.gather(
        _get_weather(lat, lon),
        get_slope_aspect(lat, lon, redis),
        _get_fuel_model(lat, lon, redis),
    )

    isochrones = compute_isochrones(
        lat=lat,
        lon=lon,
        fuel=fuel,
        wind_speed_mps=wind_speed,
        wind_deg=wind_deg,
        slope_deg=slope_deg,
        aspect_deg=aspect_deg,
        times_min=payload.times_min,
        moisture=moisture,
    )

    return JSONResponse({
        "center": {"lat": lat, "lon": lon},
        "fuel_model": fuel.name,
        "wind_speed_mps": round(wind_speed, 2),
        "wind_deg": round(wind_deg, 1),
        "slope_deg": round(slope_deg, 2),
        "aspect_deg": round(aspect_deg, 1),
        "moisture_pct": payload.moisture_pct,
        "isochrones": isochrones,
    })
