from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/hotspots", tags=["hotspots"])


@router.get("")
async def list_hotspots(
    request: Request,
    hours: int = Query(24, ge=1, le=168),
):
    rows = await request.app.state.db.fetch(
        """
        SELECT id, latitude, longitude, brightness, frp, confidence, satellite, acquired_at
        FROM satellite_hotspots
        WHERE acquired_at > NOW() - ($1 || ' hours')::INTERVAL
        ORDER BY acquired_at DESC
        LIMIT 500
        """,
        str(hours),
    )

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [row["longitude"], row["latitude"]]},
            "properties": {
                "id": row["id"],
                "brightness": float(row["brightness"]) if row["brightness"] is not None else None,
                "frp": float(row["frp"]) if row["frp"] is not None else None,
                "confidence": row["confidence"],
                "satellite": row["satellite"],
                "acquired_at": row["acquired_at"].isoformat() if row["acquired_at"] else None,
            },
        })

    return JSONResponse({"type": "FeatureCollection", "features": features})
