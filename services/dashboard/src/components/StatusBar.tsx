import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { HealthStats } from "../types";

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function StatusBar() {
  const [stats, setStats] = useState<HealthStats | null>(null);

  useEffect(() => {
    const load = () => void api.health().then(setStats).catch(() => null);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const dot = (ok: boolean) => (
    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${ok ? "bg-green-400" : "bg-red-500"}`} />
  );

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-400 font-mono">
      <span className="text-orange-400 font-bold tracking-widest uppercase text-sm">
        🔥 Flameye
      </span>

      {stats ? (
        <>
          <span>{dot(stats.db)}DB</span>
          <span>{dot(stats.redis)}Redis</span>
          <span
            className={stats.status === "ok" ? "text-green-400" : "text-yellow-400"}
          >
            {stats.status.toUpperCase()}
          </span>
          <span>Uptime: {fmt(stats.uptime_seconds)}</span>
          <span>Alerts today: <span className="text-white">{stats.alerts_today}</span></span>
          {stats.unacknowledged > 0 && (
            <span className="text-red-400 animate-pulse">
              ⚠ {stats.unacknowledged} unacknowledged
            </span>
          )}
        </>
      ) : (
        <span className="text-gray-600">Connecting to API...</span>
      )}
    </div>
  );
}
