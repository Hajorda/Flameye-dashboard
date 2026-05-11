import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { Alert } from "../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface Props {
  alerts: Alert[];
  cameraId?: number;
}

export function ConfidenceChart({ alerts, cameraId }: Props) {
  const filtered = cameraId != null
    ? alerts.filter((a) => a.camera_id === cameraId)
    : alerts;

  const sorted = [...filtered]
    .sort((a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime())
    .slice(-30);

  const labels = sorted.map((a) =>
    new Date(a.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  const values = sorted.map((a) => +(a.confidence * 100).toFixed(1));

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          Confidence Timeline
          {cameraId != null && <span className="text-gray-500 ml-1">— Camera {cameraId}</span>}
        </h2>
      </div>
      <div className="flex-1 p-3">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No data yet
          </div>
        ) : (
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: "Confidence %",
                  data: values,
                  borderColor: "#ef4444",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  fill: true,
                  tension: 0.3,
                  pointRadius: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  min: 0,
                  max: 100,
                  ticks: { color: "#6b7280", callback: (v) => `${v}%` },
                  grid: { color: "#1f2937" },
                },
                x: {
                  ticks: { color: "#6b7280", maxTicksLimit: 8 },
                  grid: { color: "#1f2937" },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
