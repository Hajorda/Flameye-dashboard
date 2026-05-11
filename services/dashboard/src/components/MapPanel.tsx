import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Alert, Camera } from "../types";
import { api } from "../lib/api";

// Fix Leaflet default icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const fireIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "hue-rotate-[120deg]", // CSS filter turns marker red
});

const ALERT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface Props {
  cameras: Camera[];
  alerts: Alert[];
}

export function MapPanel({ cameras, alerts }: Props) {
  const recentAlertCameraIds = new Set(
    alerts
      .filter((a) => Date.now() - new Date(a.detected_at).getTime() < ALERT_WINDOW_MS)
      .map((a) => a.camera_id)
  );

  const center: [number, number] =
    cameras.length > 0
      ? [cameras[0].latitude, cameras[0].longitude]
      : [20, 0];

  return (
    <div className="h-full rounded-lg overflow-hidden border border-gray-800">
      <MapContainer
        center={center}
        zoom={cameras.length > 0 ? 10 : 2}
        className="h-full w-full"
        style={{ background: "#1f2937" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {cameras.map((cam) => {
          const onFire = recentAlertCameraIds.has(cam.id);
          const lastAlert = alerts.find((a) => a.camera_id === cam.id);
          return (
            <Marker
              key={cam.id}
              position={[cam.latitude, cam.longitude]}
              icon={onFire ? fireIcon : new L.Icon.Default()}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{cam.name}</strong>
                  <br />
                  {cam.location_label && <span>{cam.location_label}<br /></span>}
                  {onFire ? (
                    <>
                      <span className="text-red-600 font-bold">🔥 FIRE DETECTED</span>
                      {lastAlert && (
                        <>
                          <br />
                          <span>Conf: {(lastAlert.confidence * 100).toFixed(1)}%</span>
                          <br />
                          <img
                            src={api.imageUrl(lastAlert.image_filename)}
                            alt="alert"
                            style={{ maxWidth: 180, marginTop: 4 }}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-green-600">✓ Normal</span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
