import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..db.queries import create_perimeter, delete_perimeter, get_perimeters

router = APIRouter(prefix="/api/perimeters", tags=["perimeters"])


class PerimeterPayload(BaseModel):
    name: str = "Unnamed Zone"
    geojson: dict
    camera_id: int | None = None
    alert_id: int | None = None


def _ser(rows) -> list[dict]:
    result = []
    for row in rows:
        record = dict(row)
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
            elif isinstance(v, str):
                pass  # already serializable
        # geojson is stored as asyncpg Record or string — normalise to dict
        if "geojson" in record and isinstance(record["geojson"], str):
            try:
                record["geojson"] = json.loads(record["geojson"])
            except Exception:
                pass
        result.append(record)
    return result


@router.get("")
async def list_perimeters(request: Request):
    rows = await get_perimeters(request.app.state.db)
    return JSONResponse(_ser(rows))


@router.post("")
async def add_perimeter(payload: PerimeterPayload, request: Request):
    geojson_str = json.dumps(payload.geojson)
    row = await create_perimeter(
        request.app.state.db,
        name=payload.name,
        geojson=geojson_str,
        camera_id=payload.camera_id,
        alert_id=payload.alert_id,
        created_by="operator",
    )
    record = dict(row)
    for k, v in record.items():
        if hasattr(v, "isoformat"):
            record[k] = v.isoformat()
    if "geojson" in record and isinstance(record["geojson"], str):
        try:
            record["geojson"] = json.loads(record["geojson"])
        except Exception:
            pass
    return JSONResponse(record, status_code=201)


@router.delete("/{perimeter_id}")
async def remove_perimeter(perimeter_id: int, request: Request):
    await delete_perimeter(request.app.state.db, perimeter_id)
    return JSONResponse({"ok": True})
