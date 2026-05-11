import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { api, type AlertFilters } from "../lib/api";
import { getSeverity, SEVERITY_COLOR, SEVERITY_LABEL } from "../lib/severity";
import type { AlertsPage, Camera } from "../types";

const PAGE_SIZE = 25;

const CLASS_COLORS: Record<string, string> = {
  fire:  "bg-red-500/15 text-red-400",
  smoke: "bg-yellow-500/15 text-yellow-400",
  other: "bg-blue-500/15 text-blue-400",
};

function SortIcon({ col, active, dir }: { col: string; active: string; dir: string }) {
  if (active !== col) return <span className="material-symbols-outlined text-xs opacity-20">unfold_more</span>;
  return (
    <span className="material-symbols-outlined text-xs text-primary">
      {dir === "asc" ? "arrow_upward" : "arrow_downward"}
    </span>
  );
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AlertsPage | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AlertFilters>({});
  const [sortBy, setSortBy] = useState("detected_at");
  const [sortDir, setSortDir] = useState("desc");

  // Local filter state (applied on submit / change)
  const [fCameraId, setFCameraId] = useState("");
  const [fClass, setFClass] = useState("");
  const [fSeverity, setFSeverity] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  useEffect(() => { api.cameras(true).then(setCameras).catch(console.error); }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    api.alertsPaged(PAGE_SIZE, page * PAGE_SIZE, { ...filters, sort_by: sortBy, sort_dir: sortDir })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, filters, sortBy, sortDir]);

  function applyFilters() {
    setPage(0);
    setFilters({
      camera_id: fCameraId ? Number(fCameraId) : undefined,
      class_name: fClass || undefined,
      severity: fSeverity || undefined,
      acknowledged: fStatus === "acknowledged" ? true : fStatus === "new" ? false : undefined,
      date_from: fDateFrom || undefined,
      date_to: fDateTo || undefined,
    });
  }

  function clearFilters() {
    setFCameraId(""); setFClass(""); setFSeverity(""); setFStatus(""); setFDateFrom(""); setFDateTo("");
    setFilters({});
    setPage(0);
  }

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(0);
  }

  function toggleSelect(id: number) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (!data) return;
    const ids = data.items.map((a) => a.id);
    setSelected((s) => s.size === ids.length ? new Set() : new Set(ids));
  }

  async function bulkAcknowledge() {
    if (!selected.size) return;
    await api.acknowledgeAll([...selected]);
    setSelected(new Set());
    // Refresh
    const d = await api.alertsPaged(PAGE_SIZE, page * PAGE_SIZE, { ...filters, sort_by: sortBy, sort_dir: sortDir });
    setData(d);
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <Navbar />

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl flex flex-col gap-5">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-white text-3xl font-black tracking-tight">Alerts</h1>
              {data && (
                <p className="text-text-dark/50 text-sm mt-0.5">{data.total} total alerts</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button onClick={bulkAcknowledge}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-semibold transition-colors">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Acknowledge {selected.size}
                </button>
              )}
              <a href={api.exportCsvUrl(filters)} download
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors">
                <span className="material-symbols-outlined text-sm">download</span>
                Export CSV
              </a>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select value={fCameraId} onChange={(e) => setFCameraId(e.target.value)}
                className="col-span-1 bg-background-dark border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">All Cameras</option>
                {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select value={fClass} onChange={(e) => setFClass(e.target.value)}
                className="bg-background-dark border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">All Classes</option>
                <option value="fire">Fire</option>
                <option value="smoke">Smoke</option>
                <option value="other">Other</option>
              </select>

              <select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}
                className="bg-background-dark border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">All Severity</option>
                <option value="high">High (&ge;75%)</option>
                <option value="medium">Medium (45–75%)</option>
                <option value="low">Low (&lt;45%)</option>
              </select>

              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
                className="bg-background-dark border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">All Status</option>
                <option value="new">Unacknowledged</option>
                <option value="acknowledged">Acknowledged</option>
              </select>

              <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)}
                placeholder="From"
                className="bg-background-dark border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary" />

              <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)}
                placeholder="To"
                className="bg-background-dark border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={applyFilters}
                className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-opacity">
                Apply Filters
              </button>
              <button onClick={clearFilters}
                className="h-8 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-colors">
                Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-text-dark/50 text-xs uppercase tracking-wider">
                    <th className="w-10 p-3">
                      <input type="checkbox" checked={items.length > 0 && selected.size === items.length}
                        onChange={toggleAll}
                        className="rounded border-white/20 bg-white/5 accent-primary" />
                    </th>
                    <th className="p-3 text-left font-semibold">ID</th>
                    <th className="p-3 text-left font-semibold cursor-pointer hover:text-white transition-colors"
                      onClick={() => toggleSort("detected_at")}>
                      <div className="flex items-center gap-1">Time <SortIcon col="detected_at" active={sortBy} dir={sortDir} /></div>
                    </th>
                    <th className="p-3 text-left font-semibold cursor-pointer hover:text-white transition-colors"
                      onClick={() => toggleSort("camera_id")}>
                      <div className="flex items-center gap-1">Camera <SortIcon col="camera_id" active={sortBy} dir={sortDir} /></div>
                    </th>
                    <th className="p-3 text-left font-semibold cursor-pointer hover:text-white transition-colors"
                      onClick={() => toggleSort("class_name")}>
                      <div className="flex items-center gap-1">Class <SortIcon col="class_name" active={sortBy} dir={sortDir} /></div>
                    </th>
                    <th className="p-3 text-left font-semibold cursor-pointer hover:text-white transition-colors"
                      onClick={() => toggleSort("confidence")}>
                      <div className="flex items-center gap-1">Confidence <SortIcon col="confidence" active={sortBy} dir={sortDir} /></div>
                    </th>
                    <th className="p-3 text-left font-semibold">Severity</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-16 text-text-dark/40 text-sm">Loading…</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16 text-text-dark/40 text-sm">No alerts match your filters.</td></tr>
                  ) : items.map((alert) => {
                    const sev = getSeverity(alert.confidence);
                    const cam = cameras.find((c) => c.id === alert.camera_id);
                    const isSelected = selected.has(alert.id);
                    return (
                      <tr key={alert.id}
                        className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${isSelected ? "bg-primary/5" : ""}`}>
                        <td className="p-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(alert.id)}
                            className="rounded border-white/20 bg-white/5 accent-primary" />
                        </td>
                        <td className="p-3 font-mono text-text-dark/60 text-xs">
                          INC-{String(alert.id).padStart(3, "0")}
                        </td>
                        <td className="p-3 text-text-dark/80 whitespace-nowrap">
                          {new Date(alert.detected_at).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3 text-white font-medium">
                          {cam?.name ?? `Camera ${alert.camera_id}`}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            CLASS_COLORS[alert.class_name ?? "fire"] ?? CLASS_COLORS.fire
                          }`}>
                            {alert.class_name ?? "fire"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${sev === "high" ? "bg-red-400" : sev === "medium" ? "bg-yellow-400" : "bg-blue-400"}`}
                                style={{ width: `${(alert.confidence * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-white font-mono text-xs">
                              {(alert.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`text-xs font-semibold ${SEVERITY_COLOR[sev]}`}>
                            {SEVERITY_LABEL[sev]}
                          </span>
                        </td>
                        <td className="p-3">
                          {alert.acknowledged ? (
                            <span className="inline-flex items-center gap-1 text-xs text-text-dark/40">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <button onClick={() => navigate(`/alerts/${alert.id}`)}
                            className="flex items-center gap-1 h-7 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-colors">
                            View
                            <span className="material-symbols-outlined text-xs">chevron_right</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                <p className="text-xs text-text-dark/50">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} of {data?.total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(0)} disabled={page === 0}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                    <span className="material-symbols-outlined text-sm">first_page</span>
                  </button>
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i : Math.max(0, Math.min(page - 3, totalPages - 7)) + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          p === page ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                        }`}>
                        {p + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                  <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                    <span className="material-symbols-outlined text-sm">last_page</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
