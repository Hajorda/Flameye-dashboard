import json

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..db.queries import (
    create_camera,
    delete_camera,
    get_cameras,
    toggle_camera_active,
    update_camera,
)

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


def _serialize(rows) -> list[dict]:
    result = []
    for row in rows:
        record = dict(row)
        for key, val in record.items():
            if hasattr(val, "isoformat"):
                record[key] = val.isoformat()
        result.append(record)
    return result


def _serialize_one(row) -> dict:
    if row is None:
        return {}
    record = dict(row)
    for key, val in record.items():
        if hasattr(val, "isoformat"):
            record[key] = val.isoformat()
    return record


class CameraBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    rtsp_url: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location_label: str | None = None


@router.get("")
async def list_cameras(
    request: Request,
    all: bool = Query(False, description="Include inactive cameras"),
):
    rows = await get_cameras(request.app.state.db, all_cameras=all)
    return JSONResponse(_serialize(rows))


@router.post("", status_code=201)
async def add_camera(body: CameraBody, request: Request):
    row = await create_camera(
        request.app.state.db,
        body.name, body.rtsp_url,
        body.latitude, body.longitude,
        body.location_label,
    )
    return JSONResponse(_serialize_one(row), status_code=201)


@router.put("/{camera_id}")
async def edit_camera(camera_id: int, body: CameraBody, request: Request):
    row = await update_camera(
        request.app.state.db,
        camera_id, body.name, body.rtsp_url,
        body.latitude, body.longitude,
        body.location_label,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Camera not found")
    return JSONResponse(_serialize_one(row))


@router.patch("/{camera_id}/toggle")
async def toggle_camera(camera_id: int, request: Request):
    row = await toggle_camera_active(request.app.state.db, camera_id)
    if not row:
        raise HTTPException(status_code=404, detail="Camera not found")
    return JSONResponse(_serialize_one(row))


@router.delete("/{camera_id}", status_code=204)
async def remove_camera(camera_id: int, request: Request):
    await delete_camera(request.app.state.db, camera_id)


@router.get("/statuses")
async def camera_statuses(request: Request):
    """Return live heartbeat status for all cameras read from Redis."""
    rows = await get_cameras(request.app.state.db, all_cameras=True)
    result = []
    for row in rows:
        cam_id = row["id"]
        raw = await request.app.state.redis.get(f"camera:{cam_id}:status")
        if raw:
            status = json.loads(raw)
        else:
            status = {"state": "offline", "frames_published": 0, "error": "", "ts": None}
        result.append({"camera_id": cam_id, **status})
    return JSONResponse(result)
