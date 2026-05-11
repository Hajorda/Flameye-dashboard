import { useEffect, useRef } from "react";
import { wsUrl } from "../lib/api";

export function useWebSocket(onMessage: (data: string) => void): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl());

      ws.onmessage = (e) => onMessageRef.current(e.data as string);

      ws.onclose = () => {
        retryTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, []);
}
