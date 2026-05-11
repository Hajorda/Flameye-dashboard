from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _ser(rows) -> list[dict]:
    result = []
    for row in rows:
        record = dict(row)
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
            elif hasattr(v, "__float__") and not isinstance(v, (int, float, bool)):
                record[k] = float(v)
        result.append(record)
    return result


@router.get("")
async def list_incidents(
    request: Request,
    status: str = Query("active", pattern="^(active|contained|resolved|all)$"),
    limit: int = Query(50, ge=1, le=200),
):
    where = "" if status == "all" else "WHERE i.status = $1"
    params = [] if status == "all" else [status]

    rows = await request.app.state.db.fetch(
        f"""
        SELECT
            i.id, i.latitude, i.longitude, i.status,
            i.started_at, i.last_activity_at,
            i.alert_count, i.max_confidence,
            c.name AS camera_name
        FROM incidents i
        LEFT JOIN cameras c ON c.id = i.first_camera_id
        {where}
        ORDER BY i.last_activity_at DESC
        LIMIT {limit}
        """,
        *params,
    )
    return JSONResponse(_ser(rows))


@router.get("/{incident_id}")
async def get_incident(incident_id: int, request: Request, limit: int = Query(50, ge=1, le=200)):
    row = await request.app.state.db.fetchrow(
        """
        SELECT i.*, c.name AS camera_name
        FROM incidents i
        LEFT JOIN cameras c ON c.id = i.first_camera_id
        WHERE i.id = $1
        """,
        incident_id,
    )
    if not row:
        return JSONResponse({"detail": "not found"}, status_code=404)

    alerts = await request.app.state.db.fetch(
        "SELECT id, camera_id, detected_at, confidence, class_name, acknowledged FROM alerts WHERE incident_id = $1 ORDER BY detected_at DESC LIMIT $2",
        incident_id, limit,
    )

    record = dict(row)
    for k, v in record.items():
        if hasattr(v, "isoformat"):
            record[k] = v.isoformat()
    record["alerts"] = _ser(alerts)
    return JSONResponse(record)


@router.patch("/{incident_id}/status")
async def update_status(incident_id: int, request: Request):
    body = await request.json()
    status = body.get("status", "contained")
    if status not in ("active", "contained", "resolved"):
        return JSONResponse({"detail": "invalid status"}, status_code=400)
    await request.app.state.db.execute(
        "UPDATE incidents SET status=$2 WHERE id=$1", incident_id, status
    )
    return JSONResponse({"ok": True, "status": status})
