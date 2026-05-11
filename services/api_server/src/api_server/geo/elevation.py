import asyncio
import json
import logging
import math

import httpx

logger = logging.getLogger(__name__)

OPENTOPO_URL = "https://api.opentopodata.org/v1/srtm30m"
_DEG_PER_METER = 1 / 111_320  # ~90 m offset


def _cache_key_elev(lat: float, lon: float) -> str:
    return f"geo:elev:{lat:.4f}:{lon:.4f}"


def _cache_key_slope(lat: float, lon: float) -> str:
    return f"geo:slope:{lat:.4f}:{lon:.4f}"


async def _batch_elevation(locations: list[tuple[float, float]]) -> list[float]:
    """Fetch elevation for multiple lat/lon pairs in one HTTP call."""
    loc_str = "|".join(f"{lat},{lon}" for lat, lon in locations)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OPENTOPO_URL, params={"locations": loc_str})
    resp.raise_for_status()
    results = resp.json()["results"]
    return [r["elevation"] or 0.0 for r in results]


async def get_elevation(lat: float, lon: float, redis) -> float:
    key = _cache_key_elev(lat, lon)
    cached = await redis.get(key)
    if cached:
        return float(cached)
    try:
        elevs = await _batch_elevation([(lat, lon)])
        elev = elevs[0]
        await redis.setex(key, 86400, str(elev))
        return elev
    except Exception as exc:
        logger.warning("OpenTopoData error: %s", exc)
        return 0.0


async def get_slope_aspect(lat: float, lon: float, redis) -> tuple[float, float]:
    """
    Returns (slope_deg, aspect_deg).
    slope_deg: 0 = flat, 90 = vertical cliff
    aspect_deg: 0/360 = N, 90 = E, 180 = S, 270 = W
    """
    key = _cache_key_slope(lat, lon)
    cached = await redis.get(key)
    if cached:
        d = json.loads(cached)
        return d["slope_deg"], d["aspect_deg"]

    # ~90 m offsets in each direction
    dlat = 0.00081
    dlon = 0.00081 / max(math.cos(math.radians(lat)), 0.001)

    pts = [
        (lat, lon),           # center
        (lat + dlat, lon),    # N
        (lat - dlat, lon),    # S
        (lat, lon + dlon),    # E
        (lat, lon - dlon),    # W
    ]

    try:
        elevs = await _batch_elevation(pts)
    except Exception as exc:
        logger.warning("OpenTopoData slope fetch error: %s", exc)
        return 0.0, 0.0

    _, elev_n, elev_s, elev_e, elev_w = elevs

    dist = 90.0  # meters per offset
    dz_dx = (elev_e - elev_w) / (2 * dist)   # E–W gradient
    dz_dy = (elev_n - elev_s) / (2 * dist)   # N–S gradient

    slope_rad = math.atan(math.sqrt(dz_dx ** 2 + dz_dy ** 2))
    slope_deg = math.degrees(slope_rad)

    # Aspect: direction the slope faces (downhill direction)
    aspect_rad = math.atan2(dz_dx, dz_dy)  # atan2(E-W, N-S)
    aspect_deg = (math.degrees(aspect_rad) + 360) % 360

    result = {"slope_deg": round(slope_deg, 2), "aspect_deg": round(aspect_deg, 1)}
    await redis.setex(key, 86400, json.dumps(result))
    return result["slope_deg"], result["aspect_deg"]
