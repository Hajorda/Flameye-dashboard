-- Flameye database schema
-- Run automatically by postgres container on first start

CREATE TABLE IF NOT EXISTS cameras (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    rtsp_url        TEXT NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    location_label  TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id              SERIAL PRIMARY KEY,
    camera_id       INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    detected_at     TIMESTAMPTZ DEFAULT NOW(),
    confidence      FLOAT NOT NULL,
    image_filename  TEXT NOT NULL,
    bbox_x          INTEGER,
    bbox_y          INTEGER,
    bbox_w          INTEGER,
    bbox_h          INTEGER,
    class_name      TEXT NOT NULL DEFAULT 'fire',  -- fire | smoke | other
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_camera_id   ON alerts(camera_id);
CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacked     ON alerts(acknowledged) WHERE acknowledged = FALSE;

CREATE TABLE IF NOT EXISTS alert_notes (
    id          SERIAL PRIMARY KEY,
    alert_id    INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'note',  -- note | dispatch | system
    body        TEXT NOT NULL,
    created_by  TEXT NOT NULL DEFAULT 'operator',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_notes_alert_id ON alert_notes(alert_id);

CREATE TABLE IF NOT EXISTS fire_perimeters (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT 'Unnamed Zone',
    geojson     JSONB NOT NULL,
    camera_id   INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    alert_id    INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
    created_by  TEXT NOT NULL DEFAULT 'operator',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    active      BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_perimeters_active ON fire_perimeters(active);

-- Incident clustering
CREATE TABLE IF NOT EXISTS incidents (
    id               SERIAL PRIMARY KEY,
    first_alert_id   INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
    first_camera_id  INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    latitude         DOUBLE PRECISION NOT NULL,
    longitude        DOUBLE PRECISION NOT NULL,
    status           TEXT DEFAULT 'active',      -- active | contained | resolved
    started_at       TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL,
    alert_count      INTEGER DEFAULT 1,
    max_confidence   FLOAT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(status, last_activity_at DESC);

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL;

-- NASA FIRMS satellite hotspots
CREATE TABLE IF NOT EXISTS satellite_hotspots (
    id           SERIAL PRIMARY KEY,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    brightness   FLOAT,
    frp          FLOAT,
    confidence   TEXT,
    satellite    TEXT,
    acquired_at  TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (latitude, longitude, acquired_at)
);
CREATE INDEX IF NOT EXISTS idx_hotspots_acquired ON satellite_hotspots(acquired_at DESC);

-- Seed camera for local testing (YouTube stream)
-- Update rtsp_url, latitude, longitude as needed.
INSERT INTO cameras (name, rtsp_url, latitude, longitude, location_label)
VALUES (
    'Test Camera 1',
    'https://www.youtube.com/watch?v=hRDM3ir3l5M',
    37.7749,
    -122.4194,
    'San Francisco Test Site'
) ON CONFLICT DO NOTHING;
