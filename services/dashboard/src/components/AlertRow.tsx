import { api } from "../lib/api";
import type { Alert } from "../types";

interface Props {
  alert: Alert;
  onAcknowledge: (id: number) => void;
}

export function AlertRow({ alert, onAcknowledge }: Props) {
  const time = new Date(alert.detected_at).toLocaleString();
  const pct = (alert.confidence * 100).toFixed(1);
  const isHot = !alert.acknowledged;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isHot
          ? "border-red-600 bg-red-950/40 animate-pulse-once"
          : "border-gray-800 bg-gray-900/60"
      }`}
    >
      {/* Thumbnail */}
      <a
        href={api.imageUrl(alert.image_filename)}
        target="_blank"
        rel="noreferrer"
        className="shrink-0"
      >
        <img
          src={api.imageUrl(alert.image_filename)}
          alt="alert frame"
          className="w-20 h-14 object-cover rounded border border-gray-700"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-semibold text-sm">Camera {alert.camera_id}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              alert.confidence >= 0.8
                ? "bg-red-900 text-red-200"
                : "bg-yellow-900 text-yellow-200"
            }`}
          >
            {pct}%
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{time}</div>
      </div>

      {/* Acknowledge */}
      {isHot ? (
        <button
          onClick={() => onAcknowledge(alert.id)}
          className="shrink-0 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Ack
        </button>
      ) : (
        <span className="shrink-0 text-xs text-gray-600">✓ ack</span>
      )}
    </div>
  );
}
