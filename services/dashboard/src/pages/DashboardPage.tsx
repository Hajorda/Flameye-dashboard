import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polygon,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navbar } from "../components/Navbar";
import { useAlerts } from "../hooks/useAlerts";
import { useWebSocket } from "../hooks/useWebSocket";
import { api } from "../lib/api";
import { getSeverity, SEVERITY_COLOR, SEVERITY_ICON, SEVERITY_LABEL } from "../lib/severity";
import type { Alert, Camera, WeatherData } from "../types";

// Fix Leaflet icon paths broken by Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const fireIcon = new L.DivIcon({
  className: "",
  html: `<span class="material-symbols-outlined text-3xl text-severity-high drop-shadow-lg" style="font-variation-settings:'FILL' 1">local_fire_department</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const ALERT_WINDOW_MS = 10 * 60 * 1000;

type TileLayerType = "street" | "satellite" | "terrain";

interface Perimeter {
  id: number;
  name: string;
  geojson: { coordinates: [number, number][][] };
  camera_id: number | null;
  alert_id: number | null;
  created_at: string;
}

// ── Spread cone polygon ───────────────────────────────────────────────────────
function buildSpreadCone(
  lat: number,
  lng: number,
  windDeg: number,
  windSpeed: number
): [number, number][] {
  const baseRadius = 0.02 + windSpeed * 0.001;
  const elongation = 1 + windSpeed / 30;
  const points: [number, number][] = [];
  const steps = 32;
  const windRad = ((windDeg - 90) * Math.PI) / 180;

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    // Ellipse in local coords, major axis along wind direction
    const ex = Math.cos(theta) * baseRadius * elongation;
    const ey = Math.sin(theta) * baseRadius;
    // Rotate by wind direction
    const rx = ex * Math.cos(windRad) - ey * Math.sin(windRad);
    const ry = ex * Math.sin(windRad) + ey * Math.cos(windRad);
    points.push([lat + ry, lng + rx]);
  }
  return points;
}

// ── Draw mode map events ──────────────────────────────────────────────────────
function DrawHandler({
  active,
  points,
  onAddPoint,
  onFinalize,
}: {
  active: boolean;
  points: [number, number][];
  onAddPoint: (latlng: [number, number]) => void;
  onFinalize: () => void;
}) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
    dblclick(e) {
      if (!active) return;
      e.originalEvent.preventDefault();
      onFinalize();
    },
  });
  return points.length >= 2 ? (
    <Polyline positions={points} pathOptions={{ color: "#f47b25", weight: 2, dashArray: "6 4" }} />
  ) : null;
}

// ── Name dialog ───────────────────────────────────────────────────────────────
function NameDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("Zone " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-xl bg-ui-dark border border-white/10 shadow-2xl p-5 flex flex-col gap-4">
        <h3 className="text-white font-bold text-base">Name this zone</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="h-8 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(name.trim() || "Zone")}
            className="h-8 px-5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tileLayer, setTileLayer] = useState<TileLayerType>("street");
  const [perimeters, setPerimeters] = useState<Perimeter[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [pendingPoints, setPendingPoints] = useState<[number, number][] | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [spreadWeather, setSpreadWeather] = useState<WeatherData | null>(null);
  const { alerts, prepend } = useAlerts(100);

  useEffect(() => {
    void api.cameras().then(setCameras).catch(console.error);
    void api.perimeters().then((p) => setPerimeters(p as Perimeter[])).catch(console.error);
  }, []);

  useWebSocket((raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg && typeof msg.id === "number" && msg.detected_at) {
        prepend(msg as Alert);
      }
    } catch { /* ignore */ }
  });

  // Load weather when alert selected
  useEffect(() => {
    if (!selectedAlert) { setSpreadWeather(null); return; }
    api.weather(selectedAlert.camera_id).then(setSpreadWeather).catch(() => setSpreadWeather(null));
  }, [selectedAlert]);

  const recentCameraIds = new Set(
    alerts
      .filter((a) => Date.now() - new Date(a.detected_at).getTime() < ALERT_WINDOW_MS)
      .map((a) => a.camera_id)
  );

  const filtered = alerts.filter((a) => {
    const sev = getSeverity(a.confidence);
    if (severityFilter !== "All" && sev !== severityFilter.toLowerCase()) return false;
    if (statusFilter === "New" && a.acknowledged) return false;
    if (statusFilter === "Acknowledged" && !a.acknowledged) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.acknowledged).length;
  const mapCenter: [number, number] =
    cameras.length > 0 ? [cameras[0].latitude, cameras[0].longitude] : [37.7749, -122.4194];

  // Alert counts per camera for heatmap
  const alertCountByCamera: Record<number, number> = {};
  for (const a of alerts) {
    alertCountByCamera[a.camera_id] = (alertCountByCamera[a.camera_id] ?? 0) + 1;
  }

  const TILE_URLS: Record<TileLayerType, { url: string; attr: string }> = {
    street: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attr: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attr: '&copy; <a href="https://www.esri.com/">Esri</a>',
    },
    terrain: {
      url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
      attr: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    },
  };

  function handleAddPoint(latlng: [number, number]) {
    setDrawPoints((prev) => [...prev, latlng]);
  }

  function handleFinalize() {
    if (drawPoints.length < 3) return;
    setPendingPoints(drawPoints);
    setDrawPoints([]);
    setDrawMode(false);
  }

  const handleDrawModeToggle = useCallback(() => {
    setDrawMode((d) => !d);
    setDrawPoints([]);
  }, []);

  async function handleSavePerimeter(name: string) {
    if (!pendingPoints) return;
    const closed = [...pendingPoints, pendingPoints[0]];
    const geojson = {
      type: "Polygon",
      coordinates: [closed.map(([lat, lng]) => [lng, lat])],
    };
    try {
      await api.createPerimeter({ name, geojson });
      const fresh = await api.perimeters();
      setPerimeters(fresh as Perimeter[]);
    } catch (e) {
      console.error(e);
    }
    setPendingPoints(null);
  }

  // Build spread cone polygon
  let spreadConePoints: [number, number][] | null = null;
  if (selectedAlert && spreadWeather) {
    const cam = cameras.find((c) => c.id === selectedAlert.camera_id);
    if (cam) {
      spreadConePoints = buildSpreadCone(
        cam.latitude,
        cam.longitude,
        spreadWeather.wind_deg,
        spreadWeather.wind_speed
      );
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background-dark overflow-hidden">
      <Navbar activeAlerts={activeCount} />

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside className="flex h-full w-80 flex-shrink-0 flex-col bg-ui-dark border-r border-border-dark overflow-y-auto">
          <div className="flex flex-col gap-6 p-4">

            {/* Global stats */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-dark/60 px-2 pb-3">
                Global Statistics
              </h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Active Fires", value: recentCameraIds.size },
                  { label: "Total Alerts", value: alerts.length },
                  { label: "New Alerts (24h)", value: alerts.filter((a) => !a.acknowledged).length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between rounded-lg p-3 bg-background-dark">
                    <p className="text-sm font-medium text-text-dark/80">{label}</p>
                    <p className="text-xl font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-dark/60 px-2 pb-3">
                Filters
              </h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-dark/70 mb-1.5">Severity</label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full rounded-lg border border-border-dark bg-background-dark text-text-dark text-sm px-3 h-9 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {["All", "High", "Medium", "Low"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-dark/70 mb-1.5">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-lg border border-border-dark bg-background-dark text-text-dark text-sm px-3 h-9 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {["All", "New", "Acknowledged"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Live alerts feed */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-dark/60 px-2 pb-3">
                Live Alerts
              </h3>
              {filtered.length === 0 && (
                <p className="text-xs text-text-dark/40 px-2 py-4 text-center">
                  No alerts yet — system monitoring.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {filtered.slice(0, 20).map((alert) => {
                  const sev = getSeverity(alert.confidence);
                  const isActive = !alert.acknowledged;
                  const isSelected = selectedAlert?.id === alert.id;
                  return (
                    <div
                      key={alert.id}
                      onClick={() => {
                        setSelectedAlert((prev) => (prev?.id === alert.id ? null : alert));
                        navigate(`/alerts/${alert.id}`);
                      }}
                      onMouseEnter={() => setSelectedAlert(alert)}
                      onMouseLeave={() => setSelectedAlert(null)}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 border transition-colors ${
                        isSelected
                          ? "border-primary/60 bg-primary/15"
                          : isActive
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:bg-background-dark"
                      }`}
                    >
                      <span className={`material-symbols-outlined mt-0.5 ${SEVERITY_COLOR[sev]}`}>
                        {SEVERITY_ICON[sev]}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {SEVERITY_LABEL[sev]}
                        </p>
                        <p className="text-xs text-text-dark/70">
                          INC-{String(alert.id).padStart(3, "0")} | Camera {alert.camera_id}
                        </p>
                        <p className="text-xs text-text-dark/50">{timeAgo(alert.detected_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Map ──────────────────────────────────────────── */}
        <main className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={cameras.length > 0 ? 10 : 4}
            className="h-full w-full"
            style={{ background: "#1A1A24" }}
            doubleClickZoom={!drawMode}
          >
            <TileLayer
              key={tileLayer}
              attribution={TILE_URLS[tileLayer].attr}
              url={TILE_URLS[tileLayer].url}
            />

            {/* Alert density heatmap — below fire markers */}
            {cameras.map((cam) => {
              const count = alertCountByCamera[cam.id] ?? 0;
              if (count === 0) return null;
              const fillColor =
                count > 5 ? "#f47b25" : count > 2 ? "#facc15" : "#60a5fa";
              return (
                <CircleMarker
                  key={`heat-${cam.id}`}
                  center={[cam.latitude, cam.longitude]}
                  radius={Math.min(30, count * 5)}
                  pathOptions={{ fillColor, fillOpacity: 0.35, stroke: false }}
                />
              );
            })}

            {/* Fire perimeter overlays */}
            {perimeters.map((p) => {
              const coords = p.geojson?.coordinates?.[0];
              if (!coords) return null;
              const positions: [number, number][] = coords.map(
                ([lng, lat]: [number, number]) => [lat, lng]
              );
              return (
                <Polygon
                  key={`perim-${p.id}`}
                  positions={positions}
                  pathOptions={{ color: "#f47b25", fillOpacity: 0.15, weight: 2 }}
                />
              );
            })}

            {/* Predictive spread cone */}
            {spreadConePoints && (
              <Polygon
                positions={spreadConePoints}
                pathOptions={{ color: "#f47b25", fillColor: "rgba(244,123,37,0.2)", fillOpacity: 0.2, weight: 1.5, dashArray: "5 4" }}
              />
            )}

            {/* Draw handler */}
            <DrawHandler
              active={drawMode}
              points={drawPoints}
              onAddPoint={handleAddPoint}
              onFinalize={handleFinalize}
            />

            {/* Camera markers */}
            {cameras.map((cam) => {
              const onFire = recentCameraIds.has(cam.id);
              const lastAlert = alerts.find((a) => a.camera_id === cam.id);
              return (
                <Marker
                  key={cam.id}
                  position={[cam.latitude, cam.longitude]}
                  icon={onFire ? fireIcon : new L.Icon.Default()}
                >
                  <Popup>
                    <div className="text-sm min-w-[200px]">
                      <p className="font-bold mb-1">{cam.name}</p>
                      <p className="text-xs text-gray-500 mb-2">
                        {cam.latitude.toFixed(4)}° N, {cam.longitude.toFixed(4)}° W
                      </p>
                      {lastAlert ? (
                        <>
                          <p className="text-xs mb-1">
                            Confidence:{" "}
                            <span className="font-bold text-green-600">
                              {(lastAlert.confidence * 100).toFixed(1)}%
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 mb-2">
                            {new Date(lastAlert.detected_at).toLocaleString()}
                          </p>
                          <button
                            onClick={() => navigate(`/alerts/${lastAlert.id}`)}
                            className="w-full text-xs bg-orange-500 text-white rounded py-1 font-semibold hover:bg-orange-600"
                          >
                            View Details
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-green-600">✓ No recent alerts</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-10">
            {/* Zoom */}
            <div className="flex flex-col gap-px">
              {["add", "remove"].map((icon, i) => (
                <button
                  key={icon}
                  className={`flex size-10 items-center justify-center bg-ui-dark shadow-lg text-text-dark hover:text-primary transition-colors ${i === 0 ? "rounded-t-lg" : "rounded-b-lg"}`}
                >
                  <span className="material-symbols-outlined">{icon}</span>
                </button>
              ))}
            </div>

            <button className="flex size-10 items-center justify-center rounded-lg bg-ui-dark shadow-lg text-text-dark hover:text-primary transition-colors">
              <span className="material-symbols-outlined">my_location</span>
            </button>

            {/* Tile layer selector */}
            <div className="flex flex-col rounded-lg overflow-hidden shadow-lg border border-white/10">
              {(["street", "satellite", "terrain"] as TileLayerType[]).map((t) => {
                const icons: Record<TileLayerType, string> = {
                  street: "map",
                  satellite: "satellite_alt",
                  terrain: "terrain",
                };
                return (
                  <button
                    key={t}
                    onClick={() => setTileLayer(t)}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    className={`flex size-10 items-center justify-center transition-colors ${
                      tileLayer === t
                        ? "bg-primary text-white"
                        : "bg-ui-dark text-text-dark hover:text-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{icons[t]}</span>
                  </button>
                );
              })}
            </div>

            {/* Draw Zone toggle */}
            <button
              onClick={handleDrawModeToggle}
              title={drawMode ? "Cancel drawing" : "Draw fire zone"}
              className={`flex items-center gap-1.5 h-10 px-3 rounded-lg shadow-lg text-sm font-semibold transition-colors ${
                drawMode
                  ? "bg-primary text-white"
                  : "bg-ui-dark text-text-dark hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {drawMode ? "close" : "edit_location_alt"}
              </span>
              {drawMode ? "Cancel" : "Draw Zone"}
            </button>
          </div>

          {/* Draw mode hint */}
          {drawMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-ui-dark/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-primary/30">
              <p className="text-xs text-white font-medium">
                Click to add points · Double-click to finish zone
                {drawPoints.length > 0 && (
                  <span className="ml-2 text-primary">{drawPoints.length} point{drawPoints.length !== 1 ? "s" : ""}</span>
                )}
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-ui-dark/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
            <h4 className="text-xs font-bold uppercase text-text-dark mb-2">Legend</h4>
            {[
              { icon: "local_fire_department", color: "text-severity-high", label: "High Severity" },
              { icon: "warning", color: "text-severity-medium", label: "Medium Severity" },
              { icon: "info", color: "text-severity-low", label: "Low Severity" },
            ].map(({ icon, color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
                <span className="text-xs text-text-dark/80">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mb-1">
              <span className="size-3 rounded-full bg-primary/40" />
              <span className="text-xs text-text-dark/80">Alert density</span>
            </div>
            {perimeters.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="size-3 rounded border border-primary bg-primary/15" />
                <span className="text-xs text-text-dark/80">Fire zones</span>
              </div>
            )}
          </div>

          {/* Last updated */}
          <div className="absolute bottom-4 right-4 z-10 bg-ui-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg">
            <p className="text-xs text-text-dark/70">Last Updated: Just now</p>
          </div>
        </main>
      </div>

      {/* Name dialog for new perimeter */}
      {pendingPoints && (
        <NameDialog
          onConfirm={handleSavePerimeter}
          onCancel={() => setPendingPoints(null)}
        />
      )}
    </div>
  );
}
