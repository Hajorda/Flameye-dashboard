import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks live WebSocket clients and broadcasts alert JSON to all of them."""

    def __init__(self) -> None:
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)
        logger.info("WS client connected — total=%d", len(self._clients))

    def disconnect(self, ws: WebSocket) -> None:
        try:
            self._clients.remove(ws)
        except ValueError:
            pass
        logger.info("WS client disconnected — total=%d", len(self._clients))

    async def broadcast(self, message: str) -> None:
        dead: list[WebSocket] = []
        for ws in self._clients[:]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._clients)
