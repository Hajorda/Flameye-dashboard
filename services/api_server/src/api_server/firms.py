"""
NASA FIRMS (Fire Information for Resource Management System) poller.

Polls VIIRS_SNPP_NRT hotspots every 10 minutes for bounding boxes around
each active camera. New hotspots within 10 km of a recent alert trigger a
system note on that alert.
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
import math
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

FIRMS_URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
    "/{key}/VIIRS_SNPP_NRT/{bbox}/1"
)
POLL_INTERVAL = int(os.environ.get("FIRMS_POLL_INTERVAL", "600"))
HOTSPOT_RADIUS_KM = 10.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


async def _fetch_bbox(client: httpx.AsyncClient, api_key: str, west: float, south: float, east: float, north: float) -> list[dict]:
    bbox = f"{west:.4f},{south:.4f},{east:.4f},{north:.4f}"
    url = FIRMS_URL.format(key=api_key, bbox=bbox)
    try:
        resp = await client.get(url, timeout=30)
        if resp.status_code != 200:
            logger.warning("FIRMS HTTP %d for bbox %s", resp.status_code, bbox)
            return []
        reader = csv.DictReader(io.StringIO(resp.text))
        return list(reader)
    except Exception as exc:
        logger.warning("FIRMS fetch error: %s", exc)
        return []


async def poll_once(db, api_key: str) -> None:
    cameras = await db.fetch("SELECT id, latitude, longitude FROM cameras WHERE active = TRUE")
    if not cameras:
        return

    seen: set[tuple] = set()

    async with httpx.AsyncClient() as client:
        for cam in cameras:
            lat, lon = cam["latitude"], cam["longitude"]
            rows = await _fetch_bbox(client, api_key, lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5)

            for row in rows:
                try:
                    h_lat = float(row["latitude"])
                    h_lon = float(row["longitude"])
                    acq_date = row.get("acq_date", "")
                    acq_time = row.get("acq_time", "0000").zfill(4)
                    acq_dt_str = f"{acq_date} {acq_time[:2]}:{acq_time[2:]}:00"
                    acquired_at = datetime.strptime(acq_dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                    key = (round(h_lat, 4), round(h_lon, 4), acq_dt_str)
                    if key in seen:
                        continue
                    seen.add(key)
                except (ValueError, KeyError):
                    continue

                brightness = _safe_float(row.get("bright_ti4"))
                frp = _safe_float(row.get("frp"))
                confidence = row.get("confidence", "nominal")
                satellite = row.get("satellite", "VIIRS")

                # Upsert hotspot
                inserted = await db.fetchval(
                    """
                    INSERT INTO satellite_hotspots
                        (latitude, longitude, brightness, frp, confidence, satellite, acquired_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    ON CONFLICT (latitude, longitude, acquired_at) DO NOTHING
                    RETURNING id
                    """,
                    h_lat, h_lon, brightness, frp, confidence, satellite, acquired_at,
                )

                if not inserted:
                    continue  # already stored

                # Cross-reference with recent unacknowledged alerts
                recent_alerts = await db.fetch(
                    """
                    SELECT a.id, c.latitude, c.longitude
                    FROM alerts a
                    JOIN cameras c ON c.id = a.camera_id
                    WHERE a.acknowledged = FALSE
                      AND a.detected_at > NOW() - INTERVAL '2 hours'
                    """
                )
                for alert in recent_alerts:
                    dist = _haversine_km(h_lat, h_lon, alert["latitude"], alert["longitude"])
                    if dist <= HOTSPOT_RADIUS_KM:
                        frp_str = f"{frp:.1f} MW" if frp else "unknown"
                        note = (
                            f"NASA FIRMS satellite hotspot detected {dist:.1f} km away "
                            f"(FRP: {frp_str}, confidence: {confidence}, satellite: {satellite})"
                        )
                        await db.execute(
                            """
                            INSERT INTO alert_notes (alert_id, type, body, created_by)
                            VALUES ($1, 'system', $2, 'firms_poller')
                            """,
                            alert["id"], note,
                        )
                        logger.info("FIRMS hotspot noted on alert %d (%.1f km away, %s FRP)", alert["id"], dist, frp_str)


def _safe_float(val: str | None) -> float | None:
    try:
        return float(val) if val else None
    except ValueError:
        return None


async def run_firms_poller(db) -> None:
    api_key = os.environ.get("NASA_FIRMS_MAP_KEY", "")
    if not api_key:
        logger.info("NASA_FIRMS_MAP_KEY not set — hotspot polling disabled")
        return

    logger.info("FIRMS poller started (interval: %ds)", POLL_INTERVAL)
    while True:
        try:
            await poll_once(db, api_key)
        except Exception as exc:
            logger.error("FIRMS poll error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL)
