import { useEffect, useRef } from "react";
import type { Alert, Camera } from "../types";
import { api } from "../lib/api";

interface Props {
  camera: Camera;
  latestAlert: Alert | null;
}

export function LiveFeed({ camera, latestAlert }: Props) {
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  const RECENT_MS = 30_000;
  const isFire =
    latestAlert != null &&
    Date.now() - new Date(latestAlert.detected_at).getTime() < RECENT_MS;

  // Play audio alarm on new fire alert
  useEffect(() => {
    if (isFire && latestAlert) {
      alarmRef.current?.play().catch(() => null);
    }
  }, [isFire, latestAlert?.id]);

  return (
    <div className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
      isFire ? "border-red-500" : "border-gray-800"
    }`}>
      {/* Camera name */}
      <div className="absolute top-2 left-2 z-10 bg-black/60 text-xs text-gray-300 px-2 py-1 rounded">
        {camera.name}
      </div>

      {/* Fire overlay */}
      {isFire && latestAlert && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-900/30 backdrop-blur-sm">
          <span className="text-red-300 text-4xl mb-2">🔥</span>
          <span className="text-red-200 font-bold text-lg">FIRE DETECTED</span>
          <span className="text-red-300 text-sm">
            {(latestAlert.confidence * 100).toFixed(1)}% confidence
          </span>
          <img
            src={api.imageUrl(latestAlert.image_filename)}
            alt="fire detection"
            className="mt-3 max-h-48 rounded border border-red-500"
          />
        </div>
      )}

      {/* Placeholder when no live snapshot endpoint yet */}
      <div className="bg-gray-900 aspect-video flex items-center justify-center">
        {isFire && latestAlert ? null : (
          <div className="text-center text-gray-600">
            <div className="text-4xl mb-2">📷</div>
            <div className="text-sm">{camera.name}</div>
            <div className="text-xs mt-1 text-gray-700">
              {camera.location_label ?? ""}
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for alarm */}
      <audio ref={alarmRef} preload="auto">
        <source src="/alarm.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
}
