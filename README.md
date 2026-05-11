# Flameye — AI-Powered Wildfire Detection & Intelligence System

<p align="center">
  <img src="logo.jpeg" alt="Flameye Logo" width="100" />
</p>

> **Senior Capstone Project** — Ali Bolat

Flameye is a real-time wildfire detection and situational awareness platform. It ingests live camera streams, runs a YOLOv8-based fire/smoke detection model on every frame, and presents detected events on an interactive GIS dashboard with physics-based fire spread prediction, NASA satellite cross-referencing, and multi-camera incident clustering.

---

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Running the System](#running-the-system)
- [Dashboard Guide](#dashboard-guide)
- [API Reference](#api-reference)
- [Adding Cameras](#adding-cameras)
- [External API Keys](#external-api-keys)
- [Project Structure](#project-structure)

---

## Features

### Detection Pipeline
- **Real-time YOLO inference** — YOLOv8/YOLOv26 model trained on fire and smoke classes, running on every camera frame
- **Multi-camera support** — one inference task per camera, all running concurrently
- **Confirmation buffer** — requires 3 detections in a 5-frame window before alerting (suppresses single-frame false positives)
- **Motion gate** — skips static frames to reduce unnecessary inference
- **10-minute cooldown** — prevents alert flooding from the same camera

### GIS & Fire Intelligence
- **Rothermel fire spread model** — physics-based 30/60/120 minute isochrone polygons using wind, terrain slope, and fuel type. Not a simple ellipse — actual fire behavior science
- **Elevation & slope** — OpenTopoData SRTM 30m DEM for terrain-aware spread prediction
- **LANDFIRE fuel map** — real FBFM40 fuel model overlay (chaparral vs grass vs timber) from USGS
- **NASA FIRMS integration** — polls VIIRS satellite hotspot data every 10 minutes; cross-references satellite detections against camera alerts and adds system notes when a hotspot is found near an active alert
- **Alert density heatmap** — CircleMarker overlay showing which cameras have the most activity
- **Fire perimeter drawing** — operators can draw containment zones directly on the map; saved as GeoJSON polygons

### Incident Management
- **Incident clustering** — multiple camera alerts for the same fire are grouped into a single incident using Haversine distance (5 km radius, 2 hour window). No PostGIS required
- **Alert deduplication** — prevents the same fire from appearing as dozens of unrelated rows
- **Alert notes & dispatch** — operators can annotate any alert with free-text notes or formal dispatch records, persisted to the database
- **Bulk acknowledge** — select multiple alerts and acknowledge them in one click
- **CSV export** — filtered alert table export

### Dashboard
- **Live alert feed** — WebSocket push from server, zero polling latency
- **Interactive map** — OpenStreetMap / Esri Satellite / OpenTopoMap / LANDFIRE fuel tile layers
- **Camera stream viewer** — live MJPEG feed per camera, grid view mode
- **Camera health monitoring** — live status badges (streaming / reconnecting / error / offline), toast notifications on state transitions
- **Reports & analytics** — Chart.js charts: alerts over time, by camera, by class, by hour of day
- **Weather widget** — temperature, humidity, wind speed/direction, fire risk score per camera
- **Search** — search camera by name or jump to alert by INC-### number
- **Notification bell** — dropdown of all unacknowledged alerts

### Notifications
- **Telegram** — sends annotated alert image + confidence score (optional)
- **Email (SMTP)** — configurable alert email recipient (optional)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
│                                                                 │
│  ┌──────────────┐     frames:{id}    ┌───────────────────────┐  │
│  │ camera_agent │ ──────────────────▶│  inference_worker     │  │
│  │              │   (Redis Stream)   │                       │  │
│  │ • RTSP/YouTube                    │ • YOLOv8 detection    │  │
│  │ • 1 thread   │                    │ • Confirmation buffer │  │
│  │   per camera │                    │ • Saves alert to DB   │  │
│  └──────────────┘                    │ • Publishes to Redis  │  │
│                                      └──────────┬────────────┘  │
│                                                 │ pub/sub        │
│  ┌──────────────────────────────────────────────▼────────────┐  │
│  │                       api_server (FastAPI)                │  │
│  │                                                           │  │
│  │  REST API  ──  WebSocket /ws  ──  Static dashboard files  │  │
│  │                                                           │  │
│  │  Background tasks:                                        │  │
│  │  • Redis listener → broadcast to WebSocket clients        │  │
│  │  • NASA FIRMS poller (every 10 min)                       │  │
│  └─────────────┬─────────────────────────────────────────────┘  │
│                │                                                 │
│  ┌─────────────▼──────┐   ┌──────────────┐                      │
│  │   PostgreSQL 16     │   │   Redis 7    │                      │
│  │                     │   │              │                      │
│  │ alerts              │   │ frame streams│                      │
│  │ cameras             │   │ pub/sub      │                      │
│  │ incidents           │   │ geo cache    │                      │
│  │ alert_notes         │   │ status keys  │                      │
│  │ fire_perimeters     │   └──────────────┘                      │
│  │ satellite_hotspots  │                                         │
│  └─────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘

Browser  ◀──── WebSocket ────▶  api_server
         ◀──── REST/HTTP ─────▶  api_server
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Detection model | YOLOv8 / YOLOv26 (PyTorch) |
| Stream ingestion | OpenCV, yt-dlp |
| Backend API | FastAPI, asyncpg, asyncio |
| Message broker | Redis Streams + Pub/Sub |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Maps | Leaflet, react-leaflet |
| Charts | Chart.js, react-chartjs-2 |
| Fire spread | Rothermel (1972) — pure Python, no external lib |
| Elevation data | OpenTopoData (SRTM 30m) |
| Fuel data | LANDFIRE FBFM40 (USGS WMS) |
| Satellite data | NASA FIRMS VIIRS_SNPP_NRT |
| Weather | OpenWeatherMap API |
| Notifications | Telegram Bot API, SMTP |
| Containerization | Docker, Docker Compose |

---

## Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2) — [install](https://docs.docker.com/get-docker/)
- **Git**
- A YOLOv8 `.pt` model file trained on fire/smoke classes (see [Adding a Model](#adding-a-model))
- Optional: OpenWeatherMap API key, NASA FIRMS MAP key, Telegram bot token

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/alibolat/flameye.git
cd flameye

# 2. Copy the example environment file and fill in your values
cp .env.example .env
# Edit .env — at minimum set your model path and a camera URL

# 3. Place your YOLO model file
mkdir -p services/inference_worker/models
cp /path/to/your/best.pt services/inference_worker/models/

# 4. Build and start all services
docker compose up --build

# 5. Open the dashboard
open http://localhost:8000
```

The dashboard is available at **http://localhost:8000** after all containers start (usually ~30 seconds).

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```dotenv
# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_DB=wildfire
POSTGRES_USER=wildfire
POSTGRES_PASSWORD=changeme               # change in production
DATABASE_URL=postgresql://wildfire:changeme@postgres:5432/wildfire

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Camera Agent ──────────────────────────────────────────────────────────────
FRAME_INTERVAL=2.0          # seconds between captured frames
JPEG_QUALITY=85             # JPEG compression (1–100)
STREAM_MAX_LEN=50           # max frames buffered in Redis per camera

# ── Inference Worker ──────────────────────────────────────────────────────────
MODEL_PATH=/models/best.pt
CONFIDENCE_THRESHOLD=0.5    # minimum score to count as detection (0.0–1.0)
ALERT_COOLDOWN_SECONDS=600  # suppress repeat alerts per camera for N seconds
ALERT_CLASSES=fire,smoke,other
MOTION_THRESHOLD=-1         # -1 = disabled; set to 2–5 for real RTSP cameras
                            # (keep -1 for YouTube streams — H.264 compression
                            #  flattens pixel differences)

# ── External APIs (optional) ──────────────────────────────────────────────────
OPENWEATHERMAP_API_KEY=     # https://openweathermap.org/api  (free tier works)
NASA_FIRMS_MAP_KEY=         # https://firms.modaps.eosdis.nasa.gov/api/
TELEGRAM_BOT_TOKEN=         # leave blank to disable Telegram alerts
TELEGRAM_CHAT_ID=
```

---

## Running the System

### Start everything
```bash
docker compose up
```

### Start in background
```bash
docker compose up -d
```

### View logs for a specific service
```bash
docker compose logs -f inference_worker
docker compose logs -f camera_agent
docker compose logs -f api_server
```

### Stop everything
```bash
docker compose down
```

### Rebuild after code changes
```bash
docker compose build api_server inference_worker
docker compose up -d api_server inference_worker
```

### Adding a Model

Place your `.pt` model file in `services/inference_worker/models/`:

```bash
cp best.pt services/inference_worker/models/
```

Then set `MODEL_PATH=/models/best.pt` in `.env`. The model must be YOLOv8-compatible and trained with at least one of these class names: `fire`, `smoke`, `other`. Class indices: `0=fire, 1=other, 2=smoke`.

---

## Dashboard Guide

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/dashboard` | Live GIS map with real-time alerts, fire spread isochrones, FIRMS hotspots, incidents |
| Alerts | `/alerts` | Paginated alert table with filters, bulk acknowledge, CSV export |
| Alert Detail | `/alerts/:id` | Full alert info, annotated image lightbox, confidence timeline, notes |
| Cameras | `/cameras` | Camera management (add/edit/delete), live feed viewer, health status |
| Reports | `/reports` | Analytics charts — alerts over time, by camera, by class, by hour |

### Map Controls
- **+ / −** — zoom in/out
- **Location pin** — fly to your GPS position (requires browser permission)
- **Search bar** — type a camera name to fly to it, or `INC-42` to jump to an alert
- **Layer buttons** — Street / Satellite / Terrain / Fuel map (LANDFIRE FBFM40)
- **Draw Zone** — click points on the map to draw a fire perimeter polygon, name and save it
- **Notification bell** — dropdown of all unacknowledged alerts

### Fire Spread Rings
Click any alert in the sidebar → three dashed rings appear on the map:
- **Red** = 30 minute spread boundary
- **Orange** = 60 minute spread boundary
- **Yellow** = 120 minute spread boundary

Computed using the Rothermel (1972) fire spread model with live wind data, SRTM terrain slope, and LANDFIRE fuel type at the camera location.

### NASA FIRMS Hotspots
Purple circles on the map = VIIRS satellite thermal detections updated every 10 minutes. Circle size is proportional to Fire Radiative Power (FRP in MW). Click for satellite, FRP, and acquisition time. When a hotspot is within 10 km of an active alert, a system note is automatically added to that alert.

---

## API Reference

Full interactive docs available at **http://localhost:8000/api/docs** (Swagger UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List alerts (paginated, filterable) |
| GET | `/api/alerts/:id` | Single alert |
| POST | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| POST | `/api/alerts/bulk-acknowledge` | Bulk acknowledge |
| GET | `/api/alerts/:id/notes` | Get alert notes |
| POST | `/api/alerts/:id/notes` | Add note or dispatch |
| GET | `/api/alerts/export.csv` | Export alerts as CSV |
| GET | `/api/cameras` | List cameras |
| POST | `/api/cameras` | Add camera |
| PUT | `/api/cameras/:id` | Update camera |
| PATCH | `/api/cameras/:id/toggle` | Enable / disable camera |
| DELETE | `/api/cameras/:id` | Delete camera |
| GET | `/api/cameras/statuses` | Live stream health per camera |
| GET | `/api/cameras/:id/feed` | Live MJPEG stream |
| POST | `/api/spread` | Compute Rothermel fire spread isochrones |
| GET | `/api/geo/elevation` | Elevation, slope, aspect at lat/lon |
| GET | `/api/hotspots` | NASA FIRMS satellite hotspots |
| GET | `/api/incidents` | Active fire incidents |
| GET | `/api/perimeters` | Fire perimeter zones |
| POST | `/api/perimeters` | Create perimeter zone |
| DELETE | `/api/perimeters/:id` | Delete perimeter zone |
| GET | `/api/reports/alerts-over-time` | Time series (7/30/90 days) |
| GET | `/api/reports/by-camera` | Alert counts per camera |
| GET | `/api/reports/by-class` | Fire / smoke / other breakdown |
| GET | `/api/reports/by-hour` | Detection frequency by hour of day |
| GET | `/api/reports/camera-health` | Per-camera health stats |
| GET | `/api/weather/:camera_id` | Current weather at camera location |
| GET | `/health` | System health (DB, Redis, uptime) |
| WS | `/ws` | WebSocket — real-time alert and camera status events |

---

## Adding Cameras

Cameras are managed from the dashboard at `/cameras`, or directly via the API:

```bash
curl -X POST http://localhost:8000/api/cameras \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "North Ridge Camera",
    "rtsp_url": "rtsp://192.168.1.10:554/stream",
    "latitude": 37.8044,
    "longitude": -122.2712,
    "location_label": "Oakland Hills"
  }'
```

**Supported stream formats:**
- `rtsp://` — standard IP camera stream
- `https://www.youtube.com/watch?v=...` — YouTube live stream (for testing)

After adding a camera, the `camera_agent` detects it within 30 seconds (configurable via `CAMERA_POLL_INTERVAL`) and begins capturing frames. The `inference_worker` detects it simultaneously and starts a dedicated inference task.

**Motion threshold note:** For real RTSP cameras set `MOTION_THRESHOLD=2` in `.env`. For YouTube test streams keep it at `-1` (disabled) because H.264 video compression kills the pixel-difference signal used for motion detection.

---

## External API Keys

### OpenWeatherMap (weather widget + fire spread wind data)
1. Register at [openweathermap.org](https://openweathermap.org/api)
2. Free tier is sufficient (1,000 calls/day)
3. Add to `.env`: `OPENWEATHERMAP_API_KEY=your_key`

### NASA FIRMS (satellite hotspot polling)
1. Register at [firms.modaps.eosdis.nasa.gov/api](https://firms.modaps.eosdis.nasa.gov/api/)
2. Free, instant approval
3. Add to `.env`: `NASA_FIRMS_MAP_KEY=your_key`
4. Restart api_server: `docker compose up -d api_server`
5. Confirm in logs: `FIRMS poller started (interval: 600s)`

### Telegram (alert notifications)
1. Message `@BotFather` on Telegram, create a bot, copy the token
2. Get your chat ID by messaging `@userinfobot`
3. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

---

## Project Structure

```
flameye/
├── docker-compose.yml              # development stack
├── docker-compose.prod.yml         # production stack (nginx SSL termination)
├── .env                            # environment variables (not committed)
├── .env.example                    # template for .env
│
├── infra/
│   ├── postgres/init.sql           # full database schema + seed camera
│   ├── redis/redis.conf
│   └── nginx/nginx.conf            # reverse proxy config for production
│
├── services/
│   ├── camera_agent/               # Python — RTSP/YouTube → Redis frames
│   │   └── src/camera_agent/
│   │       └── main.py             # multi-camera thread manager
│   │
│   ├── inference_worker/           # Python — YOLO inference + alert saving
│   │   ├── models/                 # place best.pt here
│   │   └── src/inference_worker/
│   │       ├── main.py             # per-camera asyncio tasks
│   │       ├── detector.py         # YOLOv8 wrapper
│   │       ├── storage.py          # atomic file + DB save, incident clustering
│   │       ├── confirmation.py     # 3-in-5 frame confirmation buffer
│   │       └── motion.py           # frame-diff motion gate
│   │
│   ├── api_server/                 # Python — FastAPI REST + WebSocket
│   │   └── src/api_server/
│   │       ├── main.py             # app factory, background tasks
│   │       ├── firms.py            # NASA FIRMS poller
│   │       ├── geo/
│   │       │   └── elevation.py    # OpenTopoData client (slope/aspect)
│   │       ├── fire_spread/
│   │       │   ├── rothermel.py    # Rothermel (1972) equations
│   │       │   ├── fuel_models.py  # Scott-Burgan 40 fuel model table
│   │       │   └── isochrone.py    # bearing-wise ROS → polygon
│   │       └── routers/
│   │           ├── alerts.py
│   │           ├── cameras.py
│   │           ├── spread.py       # POST /api/spread
│   │           ├── hotspots.py     # GET /api/hotspots
│   │           ├── incidents.py    # GET /api/incidents
│   │           ├── reports.py
│   │           ├── weather.py
│   │           └── perimeters.py
│   │
│   └── dashboard/                  # React + TypeScript + Vite + Tailwind
│       └── src/
│           ├── pages/
│           │   ├── DashboardPage.tsx   # live map, isochrones, hotspots
│           │   ├── AlertsPage.tsx      # table + filters + bulk ack
│           │   ├── AlertDetailPage.tsx # lightbox, timeline, notes
│           │   ├── CamerasPage.tsx     # CRUD + live feeds
│           │   └── ReportsPage.tsx     # Chart.js analytics
│           ├── components/
│           │   ├── Navbar.tsx
│           │   └── WeatherWidget.tsx
│           └── lib/
│               └── api.ts              # all API calls in one place
│
└── scripts/
    ├── smoke_test.sh               # end-to-end health check
    └── seed_cameras.py             # insert test cameras via API
```

---

## Acknowledgements

- [Rothermel, R.C. (1972)](https://www.fs.usda.gov/research/treesearch/32533) — *A mathematical model for predicting fire spread in wildland fuels*
- [Scott & Burgan (2005)](https://www.fs.usda.gov/rm/pubs/rmrs_gtr153.html) — *Standard fire behavior fuel models: a comprehensive set for use with Rothermel's surface fire spread model*
- [LANDFIRE](https://www.landfire.gov/) — fuel and vegetation data (USGS/USFS)
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) — VIIRS satellite hotspot data
- [OpenTopoData](https://www.opentopodata.org/) — SRTM elevation API

---

*Flameye — Senior Capstone Project, 2025 — Ali Bolat*
