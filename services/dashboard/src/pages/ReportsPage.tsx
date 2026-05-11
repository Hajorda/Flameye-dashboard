import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  DoughnutController,
  BarController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import type { ReportOverTime } from "../types";

ChartJS.register(
  BarElement,
  ArcElement,
  DoughnutController,
  BarController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

type Days = 7 | 30 | 90;

const CHART_TOOLTIP = {
  backgroundColor: "#1A1A24",
  titleColor: "#fff",
  bodyColor: "rgba(255,255,255,0.6)",
  borderColor: "rgba(255,255,255,0.1)",
  borderWidth: 1,
};

const GRID_COLOR = "rgba(255,255,255,0.05)";
const TICK_COLOR = "rgba(255,255,255,0.3)";

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4 animate-pulse">
      <div className="h-4 w-40 bg-white/10 rounded" />
      <div className="h-52 bg-white/5 rounded-lg" />
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState<Days>(30);
  const [overTime, setOverTime] = useState<ReportOverTime[]>([]);
  const [byCamera, setByCamera] = useState<Array<{camera_id: number; name: string; count: number}>>([]);
  const [byClass, setByClass] = useState<Array<{class_name: string; count: number}>>([]);
  const [byHour, setByHour] = useState<Array<{hour: number; count: number}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.reportsOverTime(days),
      api.reportsByCamera(),
      api.reportsByClass(),
      api.reportsByHour(),
    ])
      .then(([ot, bc, bcl, bh]) => {
        setOverTime(ot);
        setByCamera(bc);
        setByClass(bcl);
        setByHour(bh);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  // ── Alerts Over Time ─────────────────────────────────────────────────────────
  const overTimeData = {
    labels: overTime.map((d) => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString([], { month: "short", day: "numeric" });
    }),
    datasets: [
      {
        label: "Fire",
        data: overTime.map((d) => d.fire),
        backgroundColor: "rgba(239,68,68,0.75)",
        stack: "alerts",
        borderRadius: 3,
      },
      {
        label: "Smoke",
        data: overTime.map((d) => d.smoke),
        backgroundColor: "rgba(234,179,8,0.75)",
        stack: "alerts",
        borderRadius: 3,
      },
      {
        label: "Other",
        data: overTime.map((d) => d.other),
        backgroundColor: "rgba(96,165,250,0.75)",
        stack: "alerts",
        borderRadius: 3,
      },
    ],
  };

  const overTimeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: TICK_COLOR, font: { size: 11 } } },
      tooltip: CHART_TOOLTIP,
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: TICK_COLOR, font: { size: 10 } },
        grid: { color: GRID_COLOR },
      },
      y: {
        stacked: true,
        ticks: { color: TICK_COLOR, font: { size: 10 } },
        grid: { color: GRID_COLOR },
      },
    },
  };

  // ── Alerts by Camera ─────────────────────────────────────────────────────────
  const byCameraData = {
    labels: byCamera.map((c) => c.name),
    datasets: [
      {
        label: "Alerts",
        data: byCamera.map((c) => c.count),
        backgroundColor: "rgba(244,123,37,0.7)",
        borderRadius: 4,
      },
    ],
  };

  const byCameraOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: CHART_TOOLTIP,
    },
    scales: {
      x: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
      y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
    },
  };

  // ── Alerts by Class ──────────────────────────────────────────────────────────
  const classColors: Record<string, string> = {
    fire: "rgba(239,68,68,0.8)",
    smoke: "rgba(234,179,8,0.8)",
    other: "rgba(96,165,250,0.8)",
  };

  const byClassData = {
    labels: byClass.map((c) => c.class_name.charAt(0).toUpperCase() + c.class_name.slice(1)),
    datasets: [
      {
        data: byClass.map((c) => c.count),
        backgroundColor: byClass.map((c) => classColors[c.class_name] ?? "rgba(255,255,255,0.4)"),
        borderColor: "transparent",
        hoverOffset: 6,
      },
    ],
  };

  const byClassOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: TICK_COLOR, font: { size: 11 } } },
      tooltip: CHART_TOOLTIP,
    },
  };

  // ── Detection by Hour ────────────────────────────────────────────────────────
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  const hourCounts = hourLabels.map((_, h) => byHour.find((b) => b.hour === h)?.count ?? 0);

  const byHourData = {
    labels: hourLabels,
    datasets: [
      {
        label: "Detections",
        data: hourCounts,
        backgroundColor: hourCounts.map((c) => {
          const max = Math.max(...hourCounts, 1);
          const alpha = 0.25 + (c / max) * 0.6;
          return `rgba(244,123,37,${alpha.toFixed(2)})`;
        }),
        borderRadius: 3,
      },
    ],
  };

  const byHourOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: CHART_TOOLTIP,
    },
    scales: {
      x: { ticks: { color: TICK_COLOR, font: { size: 9 }, maxRotation: 45 }, grid: { color: GRID_COLOR } },
      y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
    },
  };

  const totalAlerts = overTime.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      <Navbar />

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-white text-3xl font-black tracking-tight">Reports & Analytics</h1>
              <p className="text-text-dark/50 text-sm mt-1">
                {loading ? "Loading…" : `${totalAlerts} alerts in the last ${days} days`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Time range toggle */}
              <div className="flex rounded-lg overflow-hidden border border-white/10 bg-white/5">
                {([7, 30, 90] as Days[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`h-9 px-4 text-sm font-semibold transition-colors ${
                      days === d
                        ? "bg-primary text-white"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Export CSV */}
              <a
                href={api.exportCsvUrl({})}
                download
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export CSV
              </a>
            </div>
          </div>

          {/* Charts grid */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Alerts Over Time */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">bar_chart</span>
                  <h2 className="text-white font-bold text-base">Alerts Over Time</h2>
                </div>
                {overTime.length === 0 ? (
                  <div className="flex items-center justify-center h-52 text-text-dark/30 text-sm">No data for this period</div>
                ) : (
                  <div style={{ height: 208 }}>
                    <Bar data={overTimeData} options={overTimeOptions as never} />
                  </div>
                )}
              </div>

              {/* Alerts by Camera */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">videocam</span>
                  <h2 className="text-white font-bold text-base">Alerts by Camera</h2>
                </div>
                {byCamera.length === 0 ? (
                  <div className="flex items-center justify-center h-52 text-text-dark/30 text-sm">No data available</div>
                ) : (
                  <div style={{ height: 208 }}>
                    <Bar data={byCameraData} options={byCameraOptions as never} />
                  </div>
                )}
              </div>

              {/* Alerts by Class */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">donut_large</span>
                  <h2 className="text-white font-bold text-base">Alerts by Class</h2>
                </div>
                {byClass.length === 0 ? (
                  <div className="flex items-center justify-center h-52 text-text-dark/30 text-sm">No data available</div>
                ) : (
                  <div className="flex items-center justify-center" style={{ height: 208 }}>
                    <Doughnut data={byClassData} options={byClassOptions as never} />
                  </div>
                )}
              </div>

              {/* Detection by Hour */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">schedule</span>
                  <h2 className="text-white font-bold text-base">Detection by Hour</h2>
                </div>
                <div style={{ height: 208 }}>
                  <Bar data={byHourData} options={byHourOptions as never} />
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
