import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Navbar } from "../components/Navbar";
import WeatherWidget from "../components/WeatherWidget";
import { api } from "../lib/api";
import { getSeverity, SEVERITY_COLOR, SEVERITY_LABEL } from "../lib/severity";
import type { Alert, AlertNote, Camera, TimelinePoint } from "../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// ── Lightbox ───────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => Math.max(0.5, Math.min(5, s - e.deltaY * 0.001)));
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  }

  function onMouseUp() { setDragging(false); dragStart.current = null; }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button onClick={() => setScale((s) => Math.min(5, s + 0.5))}
          className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          <span className="material-symbols-outlined text-sm">zoom_in</span>
        </button>
        <button onClick={() => setScale((s) => Math.max(0.5, s - 0.5))}
          className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          <span className="material-symbols-outlined text-sm">zoom_out</span>
        </button>
        <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }}
          className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          <span className="material-symbols-outlined text-sm">fit_screen</span>
        </button>
        <a href={src} download
          className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          <span className="material-symbols-outlined text-sm">download</span>
        </a>
        <button onClick={onClose}
          className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {/* Zoom hint */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none select-none">
        Scroll to zoom · Drag to pan · {Math.round(scale * 100)}%
      </p>

      {/* Image */}
      <div
        className="overflow-hidden w-full h-full flex items-center justify-center"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragging ? "none" : "transform 0.15s ease",
            maxWidth: "90vw",
            maxHeight: "90vh",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Timeline chart ─────────────────────────────────────────────────────────────
function TimelineChart({ points, currentId }: { points: TimelinePoint[]; currentId: number }) {
  const labels = points.map((p) =>
    new Date(p.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  const confidences = points.map((p) => +(p.confidence * 100).toFixed(1));
  const currentIdx = points.findIndex((p) => p.id === currentId);

  const data = {
    labels,
    datasets: [
      {
        label: "Confidence %",
        data: confidences,
        borderColor: "#f47b25",
        backgroundColor: "rgba(244,123,37,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: points.map((_, i) => (i === currentIdx ? 7 : 3)),
        pointBackgroundColor: points.map((_, i) =>
          i === currentIdx ? "#f47b25" : "rgba(244,123,37,0.6)"
        ),
        pointBorderColor: points.map((_, i) =>
          i === currentIdx ? "#fff" : "transparent"
        ),
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: "#1A1A24",
      titleColor: "#fff",
      bodyColor: "rgba(255,255,255,0.6)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      callbacks: { label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y}% confidence` },
    }},
    scales: {
      x: { ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: {
        min: 0, max: 100,
        ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 }, callback: (v: number | string) => `${v}%` },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
    },
  };

  return (
    <div style={{ height: 160 }}>
      <Line data={data} options={options as never} />
    </div>
  );
}

// ── Note entry ─────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  system:   { icon: "auto_awesome",          color: "bg-primary/30" },
  note:     { icon: "edit_note",             color: "bg-blue-500/30" },
  dispatch: { icon: "local_fire_department", color: "bg-orange-500/30" },
  acknowledge: { icon: "person",             color: "bg-cyan-500/30" },
};

function NoteEntry({ note }: { note: AlertNote }) {
  const cfg = TYPE_ICON[note.type] ?? TYPE_ICON.note;
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex-shrink-0 size-6 rounded-full ${cfg.color} flex items-center justify-center`}>
        <span className="material-symbols-outlined text-xs text-white">{cfg.icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-white">{note.body}</p>
        <p className="text-xs text-text-dark/40 mt-0.5">
          {new Date(note.created_at).toLocaleString()} — {note.created_by}
        </p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
type SensorTab = "Optical (RGB)" | "Thermal" | "Satellite";

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tab, setTab] = useState<SensorTab>("Optical (RGB)");
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [notes, setNotes] = useState<AlertNote[]>([]);
  const [note, setNote] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const alertId = Number(id);

    Promise.all([
      api.alert(alertId),
      api.cameras(true),
      api.alertTimeline(alertId),
      api.getNotes(alertId),
    ]).then(([a, cameras, tl, n]) => {
      setAlert(a);
      setCamera(cameras.find((c) => c.id === a.camera_id) ?? null);
      setTimeline(tl);
      setNotes(n);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAcknowledge() {
    if (!alert) return;
    await api.acknowledge(alert.id);
    const note = await api.addNote(alert.id, "Alert acknowledged", "acknowledge");
    setAlert((a) => a ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() } : a);
    setNotes((n) => [...n, note]);
  }

  async function handleDispatch() {
    if (!alert) return;
    const n = await api.addNote(alert.id, "Emergency team dispatched to site", "dispatch");
    setNotes((prev) => [...prev, n]);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!alert || !note.trim()) return;
    const n = await api.addNote(alert.id, note.trim(), "note");
    setNotes((prev) => [...prev, n]);
    setNote("");
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background-dark">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-text-dark/40">
            <span className="material-symbols-outlined text-4xl animate-pulse">hourglass_empty</span>
            <p className="text-sm">Loading alert…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="flex flex-col h-screen bg-background-dark">
        <Navbar />
        <div className="flex flex-1 items-center justify-center text-text-dark/40 text-sm">Alert not found</div>
      </div>
    );
  }

  const sev = getSeverity(alert.confidence);
  const incidentId = `INC-${String(alert.id).padStart(3, "0")}`;
  const imgSrc = api.imageUrl(alert.image_filename);

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <Navbar />

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <button onClick={() => navigate("/alerts")}
                className="flex items-center gap-1 text-xs text-text-dark/50 hover:text-primary mb-2 transition-colors">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Alerts
              </button>
              <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">
                Fire Alarm ID: {incidentId}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${alert.acknowledged ? "bg-gray-500" : "bg-primary animate-pulse"}`} />
                  <span className={`text-sm font-bold ${alert.acknowledged ? "text-gray-400" : "text-primary"}`}>
                    {alert.acknowledged ? "Resolved" : "Active"}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold capitalize
                  ${alert.class_name === "fire" ? "bg-red-500/15 text-red-400" :
                    alert.class_name === "smoke" ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-blue-500/15 text-blue-400"}`}>
                  {alert.class_name ?? "fire"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={handleDispatch}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-opacity">
                <span className="material-symbols-outlined text-base">local_fire_department</span>
                Dispatch Team
              </button>
              {!alert.acknowledged && (
                <button onClick={handleAcknowledge}
                  className="flex items-center gap-2 h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold tracking-wide transition-colors">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Mark as False Alarm
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Left column ─────────────────────────────────────── */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 rounded-xl p-5 border border-white/10 bg-white/5">
                  <p className="text-text-dark/60 text-sm font-medium">Coordinates</p>
                  <p className="text-white text-lg font-bold">
                    {camera ? `${camera.latitude.toFixed(4)}°, ${camera.longitude.toFixed(4)}°` : "—"}
                  </p>
                  {camera?.location_label && (
                    <p className="text-text-dark/50 text-xs">{camera.location_label}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-5 border border-white/10 bg-white/5">
                  <p className="text-text-dark/60 text-sm font-medium">Detection Time</p>
                  <p className="text-white text-lg font-bold">
                    {new Date(alert.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </p>
                  <p className="text-text-dark/50 text-xs">{new Date(alert.detected_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-5 border border-primary/50 bg-primary/10">
                  <p className="text-primary text-sm font-medium">AI Confidence</p>
                  <p className="text-white text-lg font-bold">{(alert.confidence * 100).toFixed(1)}%</p>
                  <p className={`text-xs font-semibold ${SEVERITY_COLOR[sev]}`}>{SEVERITY_LABEL[sev]} Severity</p>
                </div>
              </div>

              {/* Weather conditions */}
              <WeatherWidget cameraId={alert.camera_id} />

              {/* Confidence timeline */}
              {timeline.length > 1 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">show_chart</span>
                    Detection Timeline — {new Date(alert.detected_at).toLocaleDateString()}
                    <span className="text-xs text-text-dark/40 font-normal ml-1">({timeline.length} alerts this day)</span>
                  </h3>
                  <TimelineChart points={timeline} currentId={alert.id} />
                </div>
              )}

              {/* Map */}
              {camera && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base font-bold text-white">Incident Location</h3>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${
                      sev === "high" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                      sev === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                      "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    }`}>
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {SEVERITY_LABEL[sev]}
                    </span>
                  </div>
                  <div className="h-64 rounded-lg overflow-hidden">
                    <MapContainer center={[camera.latitude, camera.longitude]} zoom={12} className="h-full w-full">
                      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[camera.latitude, camera.longitude]} />
                    </MapContainer>
                  </div>
                  <p className="text-xs text-text-dark/40 mt-2 text-right">{camera.name}</p>
                </div>
              )}
            </div>

            {/* ── Right column ─────────────────────────────────────── */}
            <div className="lg:col-span-1 flex flex-col gap-6">

              {/* Sensor Data / Image */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-bold text-white mb-3">Sensor Data</h3>

                {/* Tabs */}
                <div className="flex border-b border-white/10 mb-3">
                  {(["Optical (RGB)", "Thermal", "Satellite"] as SensorTab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        tab === t ? "border-primary text-primary font-bold" : "border-transparent text-text-dark/50 hover:text-white"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* Image / placeholder */}
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/40 flex items-center justify-center relative group">
                  {tab === "Optical (RGB)" ? (
                    <>
                      <img src={imgSrc} alt="Detection frame"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      {/* Click-to-expand overlay */}
                      <button
                        onClick={() => setLightboxOpen(true)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
                        title="Open full size"
                      >
                        <span className="material-symbols-outlined text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
                          zoom_in
                        </span>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text-dark/30">
                      <span className="material-symbols-outlined text-4xl">
                        {tab === "Thermal" ? "thermostat" : "satellite"}
                      </span>
                      <span className="text-xs">{tab} feed not available</span>
                    </div>
                  )}
                </div>

                {tab === "Optical (RGB)" && (
                  <button onClick={() => setLightboxOpen(true)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-colors">
                    <span className="material-symbols-outlined text-sm">open_in_full</span>
                    View Full Size
                  </button>
                )}

                <div className="flex justify-between text-xs text-text-dark/50 mt-2">
                  <span>Class: <span className="font-bold text-primary capitalize">{alert.class_name ?? "fire"}</span></span>
                  <span>Camera {alert.camera_id}</span>
                </div>
              </div>

              {/* Activity Log */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col flex-1">
                <h3 className="text-base font-bold text-white mb-3">Activity Log</h3>

                <div className="flex-grow space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 280 }}>
                  {/* System entry always first */}
                  <NoteEntry note={{
                    id: -1,
                    alert_id: alert.id,
                    type: "system",
                    body: `AI Detection — ${(alert.confidence * 100).toFixed(1)}% confidence`,
                    created_by: "System",
                    created_at: alert.detected_at,
                  }} />
                  {notes.map((n) => <NoteEntry key={n.id} note={n} />)}
                </div>

                {/* Add note form */}
                <form onSubmit={handleAddNote} className="mt-4 pt-4 border-t border-white/10">
                  <label className="text-xs font-medium text-text-dark/60 block mb-2">Add Status Update</label>
                  <div className="flex gap-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Type your update here…"
                      className="flex-grow bg-white/5 border border-white/10 rounded-lg h-9 px-3 text-sm text-white placeholder:text-text-dark/40 focus:outline-none focus:ring-1 focus:ring-primary" />
                    <button type="submit"
                      className="flex-shrink-0 flex items-center justify-center rounded-lg h-9 w-9 bg-primary text-white hover:bg-primary/90 transition-opacity">
                      <span className="material-symbols-outlined text-base">send</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox src={imgSrc} alt={`Alert ${incidentId} detection frame`} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
