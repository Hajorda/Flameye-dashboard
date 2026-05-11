import { memo, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { WeatherData } from "../types";

interface Props {
  cameraId: number;
}

function getRiskLevel(weather: WeatherData): { label: string; color: string; bg: string; border: string } {
  if (weather.wind_speed > 30 && weather.humidity < 30) {
    return { label: "HIGH RISK", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  }
  if (weather.wind_speed > 15 || weather.humidity < 50) {
    return { label: "MEDIUM RISK", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" };
  }
  return { label: "LOW RISK", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
}

function WindArrow({ deg }: { deg: number }) {
  return (
    <span
      className="material-symbols-outlined text-xl text-primary transition-transform duration-700"
      style={{ transform: `rotate(${deg}deg)`, display: "inline-block" }}
    >
      navigation
    </span>
  );
}

const WeatherWidget = memo(function WeatherWidget({ cameraId }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setLoading(true);
    setUnavailable(false);
    api
      .weather(cameraId)
      .then(setWeather)
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, [cameraId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (unavailable || !weather) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-text-dark/30 text-base">cloud_off</span>
          <h3 className="text-base font-bold text-white">Weather</h3>
        </div>
        <p className="text-text-dark/40 text-sm">Weather unavailable — API key not configured.</p>
      </div>
    );
  }

  const risk = getRiskLevel(weather);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">partly_cloudy_day</span>
          <h3 className="text-base font-bold text-white">Weather Conditions</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${risk.bg} ${risk.border} ${risk.color}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {risk.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Temperature */}
        <div className="flex flex-col gap-1 rounded-lg p-3 bg-background-dark">
          <p className="text-text-dark/50 text-xs font-medium">Temperature</p>
          <p className="text-white text-xl font-bold">{Math.round(weather.temp)}°C</p>
          <p className="text-text-dark/40 text-xs capitalize">{weather.description}</p>
        </div>

        {/* Humidity */}
        <div className="flex flex-col gap-1 rounded-lg p-3 bg-background-dark">
          <p className="text-text-dark/50 text-xs font-medium">Humidity</p>
          <p className="text-white text-xl font-bold">{weather.humidity}%</p>
          <div className="w-full h-1 bg-white/10 rounded-full mt-1">
            <div
              className="h-full rounded-full bg-blue-400"
              style={{ width: `${weather.humidity}%` }}
            />
          </div>
        </div>

        {/* Wind */}
        <div className="flex flex-col gap-1 rounded-lg p-3 bg-background-dark">
          <p className="text-text-dark/50 text-xs font-medium">Wind</p>
          <div className="flex items-center gap-1.5">
            <WindArrow deg={weather.wind_deg} />
            <p className="text-white text-xl font-bold">{Math.round(weather.wind_speed)}</p>
          </div>
          <p className="text-text-dark/40 text-xs">km/h</p>
        </div>
      </div>
    </div>
  );
});

export default WeatherWidget;
