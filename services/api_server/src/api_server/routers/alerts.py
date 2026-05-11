import csv
import io
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..db.queries import (
    acknowledge_alert,
    acknowledge_alerts_bulk,
    create_note,
    get_alert_by_id,
    get_alert_timeline,
    get_alerts,
    get_notes,
)

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _ser(rows) -> list[dict]:
    result = []
    for row in rows:
        record = dict(row)
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
        result.append(record)
    return result


def _ser_one(row) -> dict:
    if not row:
        return {}
    record = dict(row)
    for k, v in record.items():
        if hasattr(v, "isoformat"):
            record[k] = v.isoformat()
    return record


# ── List alerts ────────────────────────────────────────────────────────────────

@router.get("")
async def list_alerts(
    request: Request,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    camera_id: Optional[int] = Query(None),
    class_name: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: str = Query("detected_at"),
    sort_dir: str = Query("desc"),
):
    rows, total = await get_alerts(
        request.app.state.db,
        limit=limit, offset=offset,
        camera_id=camera_id, class_name=class_name,
        acknowledged=acknowledged, severity=severity,
        date_from=date_from, date_to=date_to,
        sort_by=sort_by, sort_dir=sort_dir,
    )
    return JSONResponse({
        "items": _ser(rows),
        "total": total,
        "limit": limit,
        "offset": offset,
    })


# ── CSV export ─────────────────────────────────────────────────────────────────

@router.get("/export.csv")
async def export_alerts_csv(
    request: Request,
    camera_id: Optional[int] = Query(None),
    class_name: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    rows, _ = await get_alerts(
        request.app.state.db,
        limit=10_000, offset=0,
        camera_id=camera_id, class_name=class_name,
        acknowledged=acknowledged, severity=severity,
        date_from=date_from, date_to=date_to,
    )

    buf = io.StringIO()
    fields = ["id", "camera_id", "detected_at", "confidence", "class_name",
              "acknowledged", "acknowledged_at", "acknowledged_by",
              "bbox_x", "bbox_y", "bbox_w", "bbox_h", "image_filename"]
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in _ser(rows):
        writer.writerow(row)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=flameye_alerts.csv"},
    )


# ── Single alert ───────────────────────────────────────────────────────────────

@router.get("/{alert_id}")
async def get_alert(alert_id: int, request: Request):
    row = await get_alert_by_id(request.app.state.db, alert_id)
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return JSONResponse(_ser_one(row))


# ── Acknowledge ────────────────────────────────────────────────────────────────

@router.post("/{alert_id}/acknowledge")
async def ack_alert(alert_id: int, request: Request):
    await acknowledge_alert(request.app.state.db, alert_id)
    return {"ok": True}


@router.post("/bulk-acknowledge")
async def bulk_ack(request: Request, ids: list[int] = Body(...)):
    if not ids:
        raise HTTPException(status_code=400, detail="ids list is empty")
    await acknowledge_alerts_bulk(request.app.state.db, ids)
    return {"ok": True, "count": len(ids)}


# ── Timeline ───────────────────────────────────────────────────────────────────

@router.get("/{alert_id}/timeline")
async def alert_timeline(alert_id: int, request: Request):
    row = await get_alert_by_id(request.app.state.db, alert_id)
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    rows = await get_alert_timeline(request.app.state.db, row["camera_id"], alert_id)
    return JSONResponse(_ser(rows))


# ── Notes ──────────────────────────────────────────────────────────────────────

@router.get("/{alert_id}/notes")
async def list_notes(alert_id: int, request: Request):
    rows = await get_notes(request.app.state.db, alert_id)
    return JSONResponse(_ser(rows))


@router.post("/{alert_id}/notes", status_code=201)
async def add_note(
    alert_id: int,
    request: Request,
    body: str = Body(..., embed=True),
    type: str = Body("note", embed=True),
    created_by: str = Body("operator", embed=True),
):
    row = await create_note(request.app.state.db, alert_id, type, body, created_by)
    return JSONResponse(_ser_one(row), status_code=201)
