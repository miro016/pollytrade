"""Tests for TradingEngine orchestrator and control endpoints."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


class TestEngineEndpoints:
    """Test FastAPI control endpoints."""

    def setup_method(self):
        # Patch PocketBase to avoid real connections
        with patch("app.services.pocketbase.PocketBaseClient") as mock_pb_cls:
            mock_pb = AsyncMock()
            mock_pb.health_check = AsyncMock(return_value=False)
            mock_pb.list_records = AsyncMock(return_value=[])
            mock_pb.close = AsyncMock()
            mock_pb_cls.return_value = mock_pb

            with patch("app.main.pb_client", mock_pb):
                with patch("app.main.engine") as mock_engine:
                    mock_engine.running = False
                    mock_engine.start = AsyncMock()
                    mock_engine.stop = AsyncMock()
                    from app.main import app
                    self.client = TestClient(app, raise_server_exceptions=False)

    def test_health_endpoint(self):
        resp = self.client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "mode" in data
        assert "timestamp" in data

    def test_status_endpoint(self):
        resp = self.client.get("/status")
        assert resp.status_code == 200


class TestMarketDiscovery:
    """Test MarketDiscoveryService."""

    @pytest.mark.asyncio
    async def test_load_from_pocketbase_fallback(self):
        """When Polymarket API fails, should fall back to PocketBase cache."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[
            {"id": "1", "polymarket_id": "abc", "question": "Test?", "status": "active", "volume": 5000},
        ])

        from app.services.market_discovery import MarketDiscoveryService
        service = MarketDiscoveryService(mock_pb)

        with patch.object(service, "_fetch_polymarket_markets", side_effect=Exception("API down")):
            markets = await service.discover_and_sync()

        assert len(markets) == 1
        assert markets[0]["polymarket_id"] == "abc"

    @pytest.mark.asyncio
    async def test_get_asset_ids_empty(self):
        """Should return empty list when no markets found."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[])

        from app.services.market_discovery import MarketDiscoveryService
        service = MarketDiscoveryService(mock_pb)

        with patch.object(service, "_fetch_polymarket_markets", side_effect=Exception("fail")):
            ids = await service.get_asset_ids()

        assert ids == []


class TestTradingEngineUnit:
    """Unit tests for TradingEngine methods."""

    @pytest.mark.asyncio
    async def test_engine_initialization(self):
        """Engine should initialize with correct defaults."""
        mock_pb = AsyncMock()
        from app.services.engine import TradingEngine
        engine = TradingEngine(mock_pb)

        assert engine.running is False
        assert engine._price_history == {}
        assert engine._markets == []

    @pytest.mark.asyncio
    async def test_on_price_update(self):
        """Price updates should be stored in history."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[])

        from app.services.engine import TradingEngine
        engine = TradingEngine(mock_pb)
        engine._markets = [{"asset_id": "token123", "polymarket_id": "market1"}]

        await engine._on_price_update("token123", 0.65)

        assert "market1" in engine._price_history
        assert engine._price_history["market1"] == [0.65]

    @pytest.mark.asyncio
    async def test_price_history_capped(self):
        """Price history should be capped at 500 entries."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[])

        from app.services.engine import TradingEngine
        engine = TradingEngine(mock_pb)
        engine._markets = [{"asset_id": "token1", "polymarket_id": "m1"}]
        engine._price_history["m1"] = list(range(500))

        await engine._on_price_update("token1", 0.5)

        assert len(engine._price_history["m1"]) == 500

    @pytest.mark.asyncio
    async def test_save_portfolio_snapshot(self):
        """Portfolio snapshot should call PocketBase create/update."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[
            {"id": "port1", "peak_balance": 10000},
        ])
        mock_pb.update_record = AsyncMock(return_value={})

        from app.services.engine import TradingEngine
        engine = TradingEngine(mock_pb)

        await engine._save_portfolio_snapshot()
        mock_pb.update_record.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_bot_status_creates_if_empty(self):
        """Should create bot_status record if none exists."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[])
        mock_pb.create_record = AsyncMock(return_value={"id": "new"})

        from app.services.engine import TradingEngine
        engine = TradingEngine(mock_pb)

        await engine._update_bot_status(running=True)
        mock_pb.create_record.assert_called_once()
