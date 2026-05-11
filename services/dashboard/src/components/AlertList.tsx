import type { Alert } from "../types";
import { AlertRow } from "./AlertRow";

interface Props {
  alerts: Alert[];
  loading: boolean;
  onAcknowledge: (id: number) => void;
}

export function AlertList({ alerts, loading, onAcknowledge }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          Alerts
        </h2>
        <span className="text-xs text-gray-500">{alerts.length} shown</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading && (
          <p className="text-center text-gray-500 text-sm py-8">Loading...</p>
        )}
        {!loading && alerts.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-8">
            No alerts yet — system monitoring.
          </p>
        )}
        {alerts.map((a) => (
          <AlertRow key={a.id} alert={a} onAcknowledge={onAcknowledge} />
        ))}
      </div>
    </div>
  );
}
