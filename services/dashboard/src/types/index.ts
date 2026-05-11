export interface Camera {
  id: number;
  name: string;
  rtsp_url: string;
  latitude: number;
  longitude: number;
  location_label: string | null;
  active: boolean;
  created_at: string;
}

export interface Alert {
  id: number;
  camera_id: number;
  detected_at: string;
  confidence: number;
  image_filename: string;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_w: number | null;
  bbox_h: number | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  class_name?: string;
}

export interface AlertNote {
  id: number;
  alert_id: number;
  type: "note" | "dispatch" | "system";
  body: string;
  created_by: string;
  created_at: string;
}

export interface TimelinePoint {
  id: number;
  confidence: number;
  class_name: string;
  detected_at: string;
}

export interface AlertsPage {
  items: Alert[];
  total: number;
  limit: number;
  offset: number;
}

export interface HealthStats {
  status: "ok" | "degraded";
  uptime_seconds: number;
  db: boolean;
  redis: boolean;
  alerts_today: number;
  unacknowledged: number;
}

export interface LiveAlert extends Alert {
  camera_name?: string;
}

export interface WeatherData {
  temp: number;
  humidity: number;
  wind_speed: number;
  wind_deg: number;
  description: string;
  icon: string;
}

export interface ReportOverTime {
  date: string;
  count: number;
  fire: number;
  smoke: number;
  other: number;
}
