from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from ..db.queries import (
    report_alerts_over_time,
    report_by_camera,
    report_by_class,
    report_by_hour,
    report_camera_health,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _ser(rows) -> list[dict]:
    result = []
    for row in rows:
        record = dict(row)
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
            elif hasattr(v, "__float__"):
                record[k] = float(v)
        result.append(record)
    return result


@router.get("/alerts-over-time")
async def alerts_over_time(request: Request, days: int = Query(7, ge=1, le=365)):
    rows = await report_alerts_over_time(request.app.state.db, days)
    return JSONResponse(_ser(rows))


@router.get("/by-camera")
async def by_camera(request: Request):
    rows = await report_by_camera(request.app.state.db)
    return JSONResponse(_ser(rows))


@router.get("/by-class")
async def by_class(request: Request):
    rows = await report_by_class(request.app.state.db)
    return JSONResponse(_ser(rows))


@router.get("/by-hour")
async def by_hour(request: Request):
    rows = await report_by_hour(request.app.state.db)
    # Fill in missing hours with 0
    data = {r["hour"]: int(r["count"]) for r in rows}
    return JSONResponse([{"hour": h, "count": data.get(h, 0)} for h in range(24)])


@router.get("/camera-health")
async def camera_health(request: Request):
    rows = await report_camera_health(request.app.state.db)
    return JSONResponse(_ser(rows))
