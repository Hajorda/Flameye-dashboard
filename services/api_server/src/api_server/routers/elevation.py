from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from ..geo.elevation import get_elevation, get_slope_aspect

router = APIRouter(prefix="/api/geo", tags=["geo"])


@router.get("/elevation")
async def elevation(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    redis = request.app.state.redis
    elev = await get_elevation(lat, lon, redis)
    slope_deg, aspect_deg = await get_slope_aspect(lat, lon, redis)
    return JSONResponse({
        "latitude": lat,
        "longitude": lon,
        "elevation_m": round(elev, 1),
        "slope_deg": round(slope_deg, 2),
        "aspect_deg": round(aspect_deg, 1),
    })
