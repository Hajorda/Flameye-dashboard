import { useCallback, useEffect, useRef, useState, memo } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navbar } from "../components/Navbar";
import { api, type CameraPayload, type CameraStatus } from "../lib/api";
import { useWebSocket } from "../hooks/useWebSocket";
import type { Camera } from "../types";

// Fix Leaflet default marker icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Toast ──────────────────────────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  type: "warning" | "error" | "info";
}

let toastSeq = 0;

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium pointer-events-auto ${
            t.type === "error"
              ? "bg-red-900/90 border-red-500/40 text-red-100"
              : t.type === "warning"
              ? "bg-yellow-900/90 border-yellow-500/40 text-yellow-100"
              : "bg-ui-dark border-white/10 text-white"
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {t.type === "error" ? "error" : t.type === "warning" ? "warning" : "info"}
          </span>
          {t.message}
          <button onClick={() => onDismiss(t.id)} className="ml-2 opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
const STATE_CONFIG: Record<CameraStatus["state"], { label: string; dot: string; text: string }> = {
  streaming:    { label: "Streaming",    dot: "bg-green-400 animate-pulse", text: "text-green-400" },
  connecting:   { label: "Connecting",   dot: "bg-yellow-400 animate-pulse", text: "text-yellow-400" },
  reconnecting: { label: "Reconnecting", dot: "bg-yellow-400 animate-pulse", text: "text-yellow-400" },
  error:        { label: "Error",        dot: "bg-red-400",                  text: "text-red-400" },
  offline:      { label: "Offline",      dot: "bg-white/20",                 text: "text-white/30" },
};

function StatusBadge({ status }: { status: CameraStatus | undefined }) {
  const state = status?.state ?? "offline";
  const cfg = STATE_CONFIG[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 ${cfg.text}`}>
      <span className={`size-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
      {status?.frames_published ? (
        <span className="opacity-50 font-normal ml-0.5">· {status.frames_published} frames</span>
      ) : null}
    </span>
  );
}

// ── Map pin picker ─────────────────────────────────────────────────────────────
const EMPTY: CameraPayload = {
  name: "", rtsp_url: "", latitude: 37.7749, longitude: -122.4194, location_label: "",
};

function LocationPicker({ lat, lng, onChange }: {
  lat: number; lng: number; onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({ click(e) { onChange(e.latlng.lat, e.latlng.lng); } });
  return <Marker position={[lat, lng]} />;
}

// ── Camera modal ───────────────────────────────────────────────────────────────
function CameraModal({ initial, onSave, onClose }: {
  initial: Camera | null;
  onSave: (payload: CameraPayload, id?: number) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CameraPayload>(
    initial
      ? { name: initial.name, rtsp_url: initial.rtsp_url, latitude: initial.latitude, longitude: initial.longitude, location_label: initial.location_label ?? "" }
      : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof CameraPayload, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.rtsp_url.trim()) { setError("Name and stream URL are required."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ ...form, location_label: form.location_label || null }, initial?.id);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-ui-dark border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white text-xl font-bold">{initial ? "Edit Camera" : "Add Camera"}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          <div>
            <label className="block text-sm font-medium text-text-dark/70 mb-1">Camera Name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. North Ridge Camera"
              className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm text-white placeholder:text-text-dark/40 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-dark/70 mb-1">
              Stream URL <span className="ml-1 text-xs text-text-dark/40">RTSP or YouTube</span>
            </label>
            <input value={form.rtsp_url} onChange={(e) => set("rtsp_url", e.target.value)}
              placeholder="rtsp://192.168.1.100:554/stream  or  https://youtube.com/..."
              className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm text-white placeholder:text-text-dark/40 focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-dark/70 mb-1">Location Label (optional)</label>
            <input value={form.location_label ?? ""} onChange={(e) => set("location_label", e.target.value)}
              placeholder="e.g. San Francisco Test Site"
              className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm text-white placeholder:text-text-dark/40 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-dark/70 mb-1">Latitude</label>
              <input type="number" step="any" value={form.latitude}
                onChange={(e) => set("latitude", parseFloat(e.target.value) || 0)}
                className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-dark/70 mb-1">Longitude</label>
              <input type="number" step="any" value={form.longitude}
                onChange={(e) => set("longitude", parseFloat(e.target.value) || 0)}
                className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-dark/70 mb-2">
              Pin Location <span className="ml-1 text-xs text-text-dark/40">Click map to place</span>
            </label>
            <div className="h-56 rounded-lg overflow-hidden border border-white/10">
              <MapContainer center={[form.latitude, form.longitude]} zoom={10} className="h-full w-full">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker lat={form.latitude} lng={form.longitude}
                  onChange={(lat, lng) => { set("latitude", parseFloat(lat.toFixed(6))); set("longitude", parseFloat(lng.toFixed(6))); }} />
              </MapContainer>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-10 px-5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="h-10 px-6 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold tracking-wide transition-opacity disabled:opacity-50">
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Camera"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Live feed modal ────────────────────────────────────────────────────────────
const LiveFeedModal = memo(function LiveFeedModal({
  camera,
  status,
  onClose,
}: {
  camera: Camera;
  status: CameraStatus | undefined;
  onClose: () => void;
}) {
  const feedUrl = api.feedUrl(camera.id);
  const isStreaming = status?.state === "streaming";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-ui-dark border border-white/10 shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className={`size-2.5 rounded-full flex-shrink-0 ${isStreaming ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
            <div>
              <h2 className="text-white font-bold text-base leading-tight">{camera.name}</h2>
              {camera.location_label && (
                <p className="text-text-dark/50 text-xs">{camera.location_label}</p>
              )}
            </div>
            <StatusBadge status={status} />
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Feed */}
        <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 360 }}>
          {isStreaming ? (
            <img
              src={feedUrl}
              alt={`Live feed — ${camera.name}`}
              className="w-full object-contain max-h-[60vh]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-text-dark/40">
              <span className="material-symbols-outlined text-5xl">videocam_off</span>
              <p className="text-sm">
                {status?.state === "reconnecting" ? "Camera is reconnecting…" :
                 status?.state === "error" ? `Stream error: ${status.error}` :
                 "Camera is offline or not yet started"}
              </p>
            </div>
          )}

          {/* Live badge overlay */}
          {isStreaming && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <span className="size-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
            </div>
          )}

          {/* Frame count overlay */}
          {status && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <span className="text-white/60 text-xs font-mono">{status.frames_published} frames</span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 text-xs text-text-dark/50">
          <span className="font-mono truncate max-w-xs">{camera.rtsp_url}</span>
          <span>{camera.latitude.toFixed(4)}°, {camera.longitude.toFixed(4)}°</span>
        </div>
      </div>
    </div>
  );
});

// ── Stream type badge ──────────────────────────────────────────────────────────
function StreamTypeBadge({ url }: { url: string }) {
  const isYT = url.includes("youtube.com") || url.includes("youtu.be");
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      isYT ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
    }`}>
      <span className="material-symbols-outlined text-xs">{isYT ? "smart_display" : "videocam"}</span>
      {isYT ? "YouTube" : "RTSP"}
    </span>
  );
}

// ── Grid Feed Card ─────────────────────────────────────────────────────────────
const GridFeedCard = memo(function GridFeedCard({
  camera,
  status,
  onSnapshot,
}: {
  camera: Camera;
  status: CameraStatus | undefined;
  onSnapshot: (cam: Camera) => void;
}) {
  const isStreaming = status?.state === "streaming";
  const feedUrl = api.feedUrl(camera.id);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white text-sm font-semibold truncate">{camera.name}</span>
          <StatusBadge status={camera.active ? status : undefined} />
        </div>
        <button
          onClick={() => onSnapshot(camera)}
          title="Open snapshot"
          className="flex-shrink-0 flex items-center justify-center size-7 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-sm">photo_camera</span>
        </button>
      </div>

      {/* Feed */}
      <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 180 }}>
        {isStreaming ? (
          <>
            <img
              src={feedUrl}
              alt={`Live feed — ${camera.name}`}
              className="w-full object-contain max-h-48"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-[10px] font-bold tracking-wide">LIVE</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-text-dark/30">
            <span className="material-symbols-outlined text-4xl">videocam_off</span>
            <p className="text-xs text-center px-3">
              {!camera.active
                ? "Inactive"
                : status?.state === "reconnecting"
                ? "Reconnecting…"
                : status?.state === "error"
                ? "Stream error"
                : "Offline"}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {camera.location_label && (
        <div className="px-3 py-1.5 border-t border-white/5">
          <p className="text-[11px] text-text-dark/40 flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-[11px]">location_on</span>
            {camera.location_label}
          </p>
        </div>
      )}
    </div>
  );
});

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [statuses, setStatuses] = useState<Record<number, CameraStatus>>({});
  const [loading, setLoading] = useState(true);
  const [modalCamera, setModalCamera] = useState<Camera | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<Camera | null>(null);
  const [feedCamera, setFeedCamera] = useState<Camera | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [gridView, setGridView] = useState(false);
  const prevStates = useRef<Record<number, CameraStatus["state"]>>({});

  function pushToast(message: string, type: Toast["type"]) {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  async function loadStatuses() {
    try {
      const data = await api.cameraStatuses();
      const map: Record<number, CameraStatus> = {};
      for (const s of data) {
        map[s.camera_id] = s;
        // Detect transitions from streaming → bad state
        const prev = prevStates.current[s.camera_id];
        if (prev === "streaming" && s.state === "reconnecting") {
          const cam = cameras.find((c) => c.id === s.camera_id);
          pushToast(`⚠ Camera "${cam?.name ?? s.camera_id}" stream dropped — reconnecting`, "warning");
        }
        if (prev === "streaming" && s.state === "error") {
          const cam = cameras.find((c) => c.id === s.camera_id);
          pushToast(`✕ Camera "${cam?.name ?? s.camera_id}" error: ${s.error}`, "error");
        }
        if ((prev === "reconnecting" || prev === "error") && s.state === "streaming") {
          const cam = cameras.find((c) => c.id === s.camera_id);
          pushToast(`✓ Camera "${cam?.name ?? s.camera_id}" reconnected`, "info");
        }
        prevStates.current[s.camera_id] = s.state;
      }
      setStatuses(map);
    } catch { /* silent */ }
  }

  async function reload() {
    setLoading(true);
    try {
      const data = await api.cameras(true);
      setCameras(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  // Poll statuses every 10s
  useEffect(() => {
    loadStatuses();
    const interval = setInterval(loadStatuses, 10_000);
    return () => clearInterval(interval);
  }, [cameras]);

  // Also update on WebSocket camera_status push
  const handleWsMessage = useCallback((raw: string) => {
    try {
      const msg = JSON.parse(raw) as CameraStatus & { camera_id: number };
      if (!("frames_published" in msg)) return; // not a camera_status message
      setStatuses((prev) => ({ ...prev, [msg.camera_id]: msg }));
    } catch { /* ignore */ }
  }, []);
  useWebSocket(handleWsMessage);

  async function handleSave(payload: CameraPayload, id?: number) {
    if (id !== undefined) await api.updateCamera(id, payload);
    else await api.createCamera(payload);
    await reload();
  }

  async function handleToggle(cam: Camera) {
    await api.toggleCamera(cam.id);
    await reload();
  }

  async function handleDelete(cam: Camera) {
    await api.deleteCamera(cam.id);
    setDeleteConfirm(null);
    await reload();
  }

  function handleSnapshot(cam: Camera) {
    window.open(api.snapshotUrl(cam.id), "_blank");
  }

  const activeCount = cameras.filter((c) => c.active).length;

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <Navbar />

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-white text-3xl font-black tracking-tight">Camera Management</h1>
              <p className="text-text-dark/50 text-sm mt-1">
                {cameras.length} camera{cameras.length !== 1 ? "s" : ""} — {activeCount} active
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Grid / List view toggle */}
              <button
                onClick={() => setGridView((v) => !v)}
                title={gridView ? "List view" : "Grid view"}
                className={`flex items-center justify-center size-10 rounded-lg transition-colors ${
                  gridView
                    ? "bg-primary text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {gridView ? "view_list" : "grid_view"}
                </span>
              </button>
              <button onClick={() => setModalCamera(null)}
                className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold tracking-wide transition-opacity">
                <span className="material-symbols-outlined text-base">add</span>
                Add Camera
              </button>
            </div>
          </div>

          {/* Camera list / grid */}
          {loading ? (
            <div className="text-text-dark/40 text-sm text-center py-20">Loading cameras…</div>
          ) : cameras.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-text-dark/40">
              <span className="material-symbols-outlined text-5xl">videocam_off</span>
              <p className="text-sm">No cameras yet. Add one to get started.</p>
            </div>
          ) : gridView ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {cameras.map((cam) => (
                <GridFeedCard
                  key={cam.id}
                  camera={cam}
                  status={statuses[cam.id]}
                  onSnapshot={handleSnapshot}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cameras.map((cam) => {
                const status = statuses[cam.id];
                return (
                  <div key={cam.id}
                    className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 sm:p-5 transition-colors ${
                      cam.active ? "border-white/10 bg-white/5 hover:bg-white/[0.07]" : "border-white/5 bg-white/[0.02] opacity-60"
                    }`}>

                    {/* Info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm truncate">{cam.name}</span>
                        <StreamTypeBadge url={cam.rtsp_url} />
                        {!cam.active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 font-medium">Inactive</span>
                        )}
                      </div>

                      {/* Live status */}
                      <div className="mb-1.5">
                        <StatusBadge status={cam.active ? status : undefined} />
                        {status?.state === "error" && status.error && (
                          <p className="text-xs text-red-400/70 mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">error</span>
                            {status.error}
                          </p>
                        )}
                        {status?.state === "reconnecting" && (
                          <p className="text-xs text-yellow-400/70 mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">sync</span>
                            Stream dropped — attempting to reconnect
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-text-dark/40 font-mono truncate max-w-sm">{cam.rtsp_url}</p>
                      {cam.location_label && (
                        <p className="text-xs text-text-dark/50 mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">location_on</span>
                          {cam.location_label}
                        </p>
                      )}
                      <p className="text-xs text-text-dark/30 mt-0.5">
                        {cam.latitude.toFixed(4)}°, {cam.longitude.toFixed(4)}°
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Live feed */}
                      <button
                        onClick={() => setFeedCamera(cam)}
                        title="View live feed"
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white/5 hover:bg-primary/20 text-white/60 hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">live_tv</span>
                        Live
                      </button>

                      <button onClick={() => handleToggle(cam)} title={cam.active ? "Deactivate" : "Activate"}
                        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          cam.active
                            ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                        }`}>
                        <span className="material-symbols-outlined text-sm">{cam.active ? "pause_circle" : "play_circle"}</span>
                        {cam.active ? "Active" : "Inactive"}
                      </button>
                      <button onClick={() => setModalCamera(cam)} title="Edit camera"
                        className="flex size-8 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => setDeleteConfirm(cam)} title="Delete camera"
                        className="flex size-8 items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {modalCamera !== undefined && (
        <CameraModal initial={modalCamera} onSave={handleSave} onClose={() => setModalCamera(undefined)} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-ui-dark border border-white/10 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400 text-3xl">warning</span>
              <div>
                <p className="text-white font-bold">Delete Camera?</p>
                <p className="text-text-dark/50 text-sm mt-0.5">
                  This will remove <span className="text-white font-semibold">{deleteConfirm.name}</span>.
                  Existing alerts are preserved.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="h-9 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {feedCamera && (
        <LiveFeedModal
          camera={feedCamera}
          status={statuses[feedCamera.id]}
          onClose={() => setFeedCamera(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
