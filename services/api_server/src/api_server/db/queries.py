from typing import Optional

import asyncpg


# ── Alerts ────────────────────────────────────────────────────────────────────

async def get_alerts(
    pool: asyncpg.Pool,
    limit: int = 50,
    offset: int = 0,
    camera_id: Optional[int] = None,
    class_name: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    severity: Optional[str] = None,     # high | medium | low
    date_from: Optional[str] = None,    # ISO date string
    date_to: Optional[str] = None,
    sort_by: str = "detected_at",
    sort_dir: str = "desc",
) -> tuple[list[asyncpg.Record], int]:
    """Returns (rows, total_count)."""
    allowed_sort = {"detected_at", "confidence", "camera_id", "class_name"}
    col = sort_by if sort_by in allowed_sort else "detected_at"
    direction = "ASC" if sort_dir.lower() == "asc" else "DESC"

    conditions: list[str] = []
    params: list = []
    i = 1

    if camera_id is not None:
        conditions.append(f"camera_id = ${i}"); params.append(camera_id); i += 1
    if class_name:
        conditions.append(f"class_name = ${i}"); params.append(class_name); i += 1
    if acknowledged is not None:
        conditions.append(f"acknowledged = ${i}"); params.append(acknowledged); i += 1
    if severity == "high":
        conditions.append(f"confidence >= 0.75")
    elif severity == "medium":
        conditions.append(f"confidence >= 0.45 AND confidence < 0.75")
    elif severity == "low":
        conditions.append(f"confidence < 0.45")
    if date_from:
        conditions.append(f"detected_at >= ${i}"); params.append(date_from); i += 1
    if date_to:
        conditions.append(f"detected_at <= ${i}"); params.append(date_to); i += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_row = await pool.fetchrow(f"SELECT COUNT(*) FROM alerts {where}", *params)
    total = count_row[0]

    rows = await pool.fetch(
        f"SELECT * FROM alerts {where} ORDER BY {col} {direction} LIMIT ${i} OFFSET ${i+1}",
        *params, limit, offset,
    )
    return list(rows), total


async def get_alert_by_id(pool: asyncpg.Pool, alert_id: int) -> Optional[asyncpg.Record]:
    return await pool.fetchrow("SELECT * FROM alerts WHERE id = $1", alert_id)


async def get_cameras(pool: asyncpg.Pool, all_cameras: bool = False) -> list[asyncpg.Record]:
    if all_cameras:
        return await pool.fetch("SELECT * FROM cameras ORDER BY id")
    return await pool.fetch("SELECT * FROM cameras WHERE active = TRUE ORDER BY id")


async def create_camera(
    pool: asyncpg.Pool,
    name: str, rtsp_url: str, latitude: float, longitude: float, location_label: Optional[str],
) -> asyncpg.Record:
    return await pool.fetchrow(
        "INSERT INTO cameras (name, rtsp_url, latitude, longitude, location_label) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        name, rtsp_url, latitude, longitude, location_label,
    )


async def update_camera(
    pool: asyncpg.Pool,
    camera_id: int, name: str, rtsp_url: str, latitude: float, longitude: float, location_label: Optional[str],
) -> Optional[asyncpg.Record]:
    return await pool.fetchrow(
        "UPDATE cameras SET name=$2, rtsp_url=$3, latitude=$4, longitude=$5, location_label=$6 WHERE id=$1 RETURNING *",
        camera_id, name, rtsp_url, latitude, longitude, location_label,
    )


async def toggle_camera_active(pool: asyncpg.Pool, camera_id: int) -> Optional[asyncpg.Record]:
    return await pool.fetchrow(
        "UPDATE cameras SET active = NOT active WHERE id=$1 RETURNING *", camera_id
    )


async def delete_camera(pool: asyncpg.Pool, camera_id: int) -> None:
    await pool.execute("DELETE FROM cameras WHERE id=$1", camera_id)


async def acknowledge_alert(
    pool: asyncpg.Pool, alert_id: int, acknowledged_by: str = "dashboard",
) -> None:
    await pool.execute(
        "UPDATE alerts SET acknowledged=TRUE, acknowledged_at=NOW(), acknowledged_by=$2 WHERE id=$1",
        alert_id, acknowledged_by,
    )


async def acknowledge_alerts_bulk(pool: asyncpg.Pool, alert_ids: list[int], by: str = "dashboard") -> None:
    await pool.execute(
        "UPDATE alerts SET acknowledged=TRUE, acknowledged_at=NOW(), acknowledged_by=$2 WHERE id = ANY($1)",
        alert_ids, by,
    )


async def get_health_stats(pool: asyncpg.Pool) -> asyncpg.Record:
    return await pool.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') AS alerts_today,
            COUNT(*) FILTER (WHERE acknowledged = FALSE)                        AS unacknowledged
        FROM alerts
        """
    )


# ── Alert timeline ─────────────────────────────────────────────────────────────

async def get_alert_timeline(pool: asyncpg.Pool, camera_id: int, alert_id: int) -> list[asyncpg.Record]:
    """Confidence of all alerts for this camera on the same day as the given alert."""
    return await pool.fetch(
        """
        SELECT id, confidence, class_name, detected_at
        FROM alerts
        WHERE camera_id = $1
          AND DATE(detected_at) = (SELECT DATE(detected_at) FROM alerts WHERE id = $2)
        ORDER BY detected_at ASC
        """,
        camera_id, alert_id,
    )


# ── Alert notes ────────────────────────────────────────────────────────────────

async def get_notes(pool: asyncpg.Pool, alert_id: int) -> list[asyncpg.Record]:
    return await pool.fetch(
        "SELECT * FROM alert_notes WHERE alert_id=$1 ORDER BY created_at ASC", alert_id
    )


async def create_note(
    pool: asyncpg.Pool,
    alert_id: int, note_type: str, body: str, created_by: str,
) -> asyncpg.Record:
    return await pool.fetchrow(
        "INSERT INTO alert_notes (alert_id, type, body, created_by) VALUES ($1,$2,$3,$4) RETURNING *",
        alert_id, note_type, body, created_by,
    )


# ── Reports ────────────────────────────────────────────────────────────────────

async def report_alerts_over_time(pool: asyncpg.Pool, days: int = 7) -> list[asyncpg.Record]:
    return await pool.fetch(
        """
        SELECT
            DATE(detected_at) AS date,
            COUNT(*) AS count,
            COUNT(*) FILTER (WHERE class_name = 'fire')  AS fire,
            COUNT(*) FILTER (WHERE class_name = 'smoke') AS smoke,
            COUNT(*) FILTER (WHERE class_name = 'other') AS other
        FROM alerts
        WHERE detected_at >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY DATE(detected_at)
        ORDER BY DATE(detected_at) ASC
        """,
        str(days),
    )


async def report_by_camera(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        """
        SELECT c.id AS camera_id, c.name, COUNT(a.id) AS count
        FROM cameras c
        LEFT JOIN alerts a ON a.camera_id = c.id
        GROUP BY c.id, c.name
        ORDER BY count DESC
        """
    )


async def report_by_class(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        "SELECT class_name, COUNT(*) AS count FROM alerts GROUP BY class_name ORDER BY count DESC"
    )


async def report_by_hour(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        """
        SELECT EXTRACT(HOUR FROM detected_at)::INT AS hour, COUNT(*) AS count
        FROM alerts
        GROUP BY hour
        ORDER BY hour ASC
        """
    )


async def report_camera_health(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        """
        SELECT
            c.id AS camera_id, c.name, c.active,
            COUNT(a.id) AS total_alerts,
            COUNT(a.id) FILTER (WHERE a.detected_at > NOW() - INTERVAL '24 hours') AS alerts_24h,
            MAX(a.detected_at) AS last_alert_at
        FROM cameras c
        LEFT JOIN alerts a ON a.camera_id = c.id
        GROUP BY c.id, c.name, c.active
        ORDER BY c.id
        """
    )


# ── Fire perimeters ────────────────────────────────────────────────────────────

async def get_perimeters(pool: asyncpg.Pool) -> list[asyncpg.Record]:
    return await pool.fetch(
        "SELECT * FROM fire_perimeters WHERE active = TRUE ORDER BY created_at DESC"
    )


async def create_perimeter(
    pool: asyncpg.Pool,
    name: str, geojson: str,
    camera_id: Optional[int], alert_id: Optional[int], created_by: str,
) -> asyncpg.Record:
    return await pool.fetchrow(
        """
        INSERT INTO fire_perimeters (name, geojson, camera_id, alert_id, created_by)
        VALUES ($1, $2::jsonb, $3, $4, $5) RETURNING *
        """,
        name, geojson, camera_id, alert_id, created_by,
    )


async def delete_perimeter(pool: asyncpg.Pool, perimeter_id: int) -> None:
    await pool.execute(
        "UPDATE fire_perimeters SET active = FALSE WHERE id = $1", perimeter_id
    )
