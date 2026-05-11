import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Alert } from "../types";

export function useAlerts(limit = 50) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await api.alerts(limit);
      setAlerts(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const prepend = useCallback((alert: Alert) => {
    setAlerts((prev) => [alert, ...prev].slice(0, limit));
  }, [limit]);

  const acknowledge = useCallback(async (id: number) => {
    await api.acknowledge(id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, []);

  return { alerts, loading, error, prepend, acknowledge, refresh: fetch };
}
