import pytest
from unittest.mock import AsyncMock, MagicMock
from api_server.ws.manager import ConnectionManager


@pytest.mark.asyncio
async def test_connect_adds_client():
    mgr = ConnectionManager()
    ws = MagicMock()
    ws.accept = AsyncMock()
    await mgr.connect(ws)
    assert mgr.count == 1


@pytest.mark.asyncio
async def test_disconnect_removes_client():
    mgr = ConnectionManager()
    ws = MagicMock()
    ws.accept = AsyncMock()
    await mgr.connect(ws)
    mgr.disconnect(ws)
    assert mgr.count == 0


@pytest.mark.asyncio
async def test_broadcast_removes_dead_clients():
    mgr = ConnectionManager()
    good = MagicMock()
    good.accept = AsyncMock()
    good.send_text = AsyncMock()

    dead = MagicMock()
    dead.accept = AsyncMock()
    dead.send_text = AsyncMock(side_effect=Exception("closed"))

    await mgr.connect(good)
    await mgr.connect(dead)

    await mgr.broadcast("test")
    assert mgr.count == 1
