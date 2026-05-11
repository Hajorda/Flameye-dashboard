import type { Alert, AlertNote, AlertsPage, Camera, HealthStats, TimelinePoint } from "../types";

const BASE = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL) ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface CameraStatus {
  camera_id: number;
  state: "streaming" | "reconnecting" | "connecting" | "error" | "offline";
  frames_published: number;
  error: string;
  ts: number | null;
}

export interface CameraPayload {
  name: string;
  rtsp_url: string;
  latitude: number;
  longitude: number;
  location_label?: string | null;
}

export interface AlertFilters {
  camera_id?: number;
  class_name?: string;
  acknowledged?: boolean;
  severity?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
}

export const api = {
  // ── Alerts ──────────────────────────────────────────────────────────────────
  alerts: (limit = 50, cameraId?: number): Promise<Alert[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cameraId != null) params.set("camera_id", String(cameraId));
    // Legacy: returns items array for backward compat
    return fetch(`${BASE}/api/alerts?${params}`)
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : (d as AlertsPage).items));
  },

  alertsPaged: (limit: number, offset: number, filters: AlertFilters = {}): Promise<AlertsPage> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filters.camera_id != null) params.set("camera_id", String(filters.camera_id));
    if (filters.class_name) params.set("class_name", filters.class_name);
    if (filters.acknowledged != null) params.set("acknowledged", String(filters.acknowledged));
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    if (filters.sort_by) params.set("sort_by", filters.sort_by);
    if (filters.sort_dir) params.set("sort_dir", filters.sort_dir);
    return get(`/api/alerts?${params}`);
  },

  alert: (id: number): Promise<Alert> => get(`/api/alerts/${id}`),

  exportCsvUrl: (filters: AlertFilters = {}): string => {
    const params = new URLSearchParams();
    if (filters.camera_id != null) params.set("camera_id", String(filters.camera_id));
    if (filters.class_name) params.set("class_name", filters.class_name);
    if (filters.acknowledged != null) params.set("acknowledged", String(filters.acknowledged));
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    return `${BASE}/api/alerts/export.csv?${params}`;
  },

  acknowledge: async (id: number): Promise<void> => {
    const res = await fetch(`${BASE}/api/alerts/${id}/acknowledge`, { method: "POST" });
    if (!res.ok) throw new Error(`Acknowledge failed: ${res.status}`);
  },

  acknowledgeAll: async (ids: number[]): Promise<void> => {
    const res = await fetch(`${BASE}/api/alerts/bulk-acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    });
    if (!res.ok) throw new Error(`Bulk acknowledge failed: ${res.status}`);
  },

  alertTimeline: (alertId: number): Promise<TimelinePoint[]> =>
    get(`/api/alerts/${alertId}/timeline`),

  getNotes: (alertId: number): Promise<AlertNote[]> =>
    get(`/api/alerts/${alertId}/notes`),

  addNote: async (alertId: number, body: string, type = "note", created_by = "operator"): Promise<AlertNote> => {
    const res = await fetch(`${BASE}/api/alerts/${alertId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, type, created_by }),
    });
    if (!res.ok) throw new Error(`Add note failed: ${res.status}`);
    return res.json();
  },

  // ── Cameras ─────────────────────────────────────────────────────────────────
  cameras: (all = false): Promise<Camera[]> =>
    get(`/api/cameras${all ? "?all=true" : ""}`),

  cameraStatuses: (): Promise<CameraStatus[]> => get("/api/cameras/statuses"),

  createCamera: async (payload: CameraPayload): Promise<Camera> => {
    const res = await fetch(`${BASE}/api/cameras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    return res.json();
  },

  updateCamera: async (id: number, payload: CameraPayload): Promise<Camera> => {
    const res = await fetch(`${BASE}/api/cameras/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    return res.json();
  },

  toggleCamera: async (id: number): Promise<Camera> => {
    const res = await fetch(`${BASE}/api/cameras/${id}/toggle`, { method: "PATCH" });
    if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
    return res.json();
  },

  deleteCamera: async (id: number): Promise<void> => {
    const res = await fetch(`${BASE}/api/cameras/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  },

  health: (): Promise<HealthStats> => get("/health"),

  imageUrl: (filename: string): string => `${BASE}/images/${filename}`,
  feedUrl: (cameraId: number): string => `${BASE}/api/cameras/${cameraId}/feed`,
  snapshotUrl: (cameraId: number): string => `${BASE}/api/cameras/${cameraId}/snapshot`,

  // ── Reports ──────────────────────────────────────────────────────────────────
  reportsOverTime: (days: number): Promise<Array<{date: string; count: number; fire: number; smoke: number; other: number}>> =>
    get(`/api/reports/alerts-over-time?days=${days}`),

  reportsByCamera: (): Promise<Array<{camera_id: number; name: string; count: number}>> =>
    get('/api/reports/by-camera'),

  reportsByClass: (): Promise<Array<{class_name: string; count: number}>> =>
    get('/api/reports/by-class'),

  reportsByHour: (): Promise<Array<{hour: number; count: number}>> =>
    get('/api/reports/by-hour'),

  // ── Fire spread (Rothermel isochrones) ───────────────────────────────────────
  spread: async (cameraId: number, alertId?: number, moisturePct = 8): Promise<{
    center: {lat: number; lon: number};
    fuel_model: string;
    wind_speed_mps: number;
    wind_deg: number;
    slope_deg: number;
    aspect_deg: number;
    moisture_pct: number;
    isochrones: Array<{minutes: number; geojson: {type: string; coordinates: number[][][]}}>;
  }> => {
    const res = await fetch(`${BASE}/api/spread`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({camera_id: cameraId, alert_id: alertId, moisture_pct: moisturePct}),
    });
    if (!res.ok) throw new Error(`Spread failed: ${res.status}`);
    return res.json();
  },

  // ── Incidents ─────────────────────────────────────────────────────────────────
  incidents: (status = 'active'): Promise<Array<{
    id: number; latitude: number; longitude: number; status: string;
    started_at: string; last_activity_at: string; alert_count: number;
    max_confidence: number; camera_name: string | null;
  }>> => get(`/api/incidents?status=${status}`),

  // ── Satellite hotspots ────────────────────────────────────────────────────────
  hotspots: (hours = 24): Promise<{type: string; features: Array<{
    type: string; geometry: {type: string; coordinates: [number, number]};
    properties: {id: number; brightness: number | null; frp: number | null; confidence: string; satellite: string; acquired_at: string};
  }>}> => get(`/api/hotspots?hours=${hours}`),

  // ── Elevation / slope ────────────────────────────────────────────────────────
  elevation: (lat: number, lon: number): Promise<{elevation_m: number; slope_deg: number; aspect_deg: number}> =>
    get(`/api/geo/elevation?lat=${lat}&lon=${lon}`),

  // ── Weather ──────────────────────────────────────────────────────────────────
  weather: (cameraId: number): Promise<{temp: number; humidity: number; wind_speed: number; wind_deg: number; description: string; icon: string}> =>
    get(`/api/weather/${cameraId}`),

  // ── Fire perimeters ───────────────────────────────────────────────────────────
  perimeters: (): Promise<Array<{id: number; name: string; geojson: object; camera_id: number | null; alert_id: number | null; created_at: string}>> =>
    get('/api/perimeters'),

  createPerimeter: async (payload: {name: string; geojson: object; camera_id?: number; alert_id?: number}): Promise<{id: number; name: string; geojson: object}> => {
    const res = await fetch(`${BASE}/api/perimeters`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Create perimeter failed: ${res.status}`);
    return res.json();
  },

  deletePerimeter: async (id: number): Promise<void> => {
    await fetch(`${BASE}/api/perimeters/${id}`, {method: 'DELETE'});
  },
};

export function wsUrl(): string {
  const base = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL) ?? "";
  const wsBase = base.replace(/^http/, "ws") || `ws://${window.location.host}`;
  return `${wsBase}/ws`;
}
