import os

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/weather", tags=["weather"])

OWM_API_KEY = os.environ.get("OPENWEATHERMAP_API_KEY", "")
OWM_BASE = "https://api.openweathermap.org/data/2.5/weather"


@router.get("/{camera_id}")
async def weather_for_camera(camera_id: int, request: Request):
    row = await request.app.state.db.fetchrow(
        "SELECT latitude, longitude FROM cameras WHERE id = $1", camera_id
    )
    if not row:
        raise HTTPException(404, "Camera not found")

    if not OWM_API_KEY:
        # Return mock data when no API key is configured
        return JSONResponse({
            "temp": 28.4,
            "humidity": 15,
            "wind_speed": 6.2,
            "wind_deg": 225,
            "description": "clear sky",
            "icon": "01d",
        })

    lat, lon = row["latitude"], row["longitude"]
    url = f"{OWM_BASE}?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)

    if resp.status_code != 200:
        raise HTTPException(502, f"OpenWeatherMap error: {resp.status_code}")

    d = resp.json()
    return JSONResponse({
        "temp": d["main"]["temp"],
        "humidity": d["main"]["humidity"],
        "wind_speed": d["wind"]["speed"],
        "wind_deg": d["wind"].get("deg", 0),
        "description": d["weather"][0]["description"],
        "icon": d["weather"][0]["icon"],
    })
