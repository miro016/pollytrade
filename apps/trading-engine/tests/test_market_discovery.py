"""Tests for MarketDiscoveryService."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.market_discovery import MarketDiscoveryService


class TestMarketDiscoverySyncLogic:
    """Test PocketBase sync logic."""

    @pytest.mark.asyncio
    async def test_sync_creates_new_market(self):
        """Should create a new PocketBase record for unknown market."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[])
        mock_pb.create_record = AsyncMock(return_value={"id": "new_id"})

        service = MarketDiscoveryService(mock_pb)
        markets = [{
            "polymarket_id": "cond_123",
            "question": "Will X happen?",
            "current_prices": {"yes": 0.6, "no": 0.4},
            "volume": 5000,
            "liquidity": 1000,
            "status": "active",
            "end_date": "2025-12-31",
            "asset_id": "token_abc",
        }]

        synced = await service._sync_to_pocketbase(markets)
        assert len(synced) == 1
        assert synced[0]["id"] == "new_id"
        mock_pb.create_record.assert_called_once()

    @pytest.mark.asyncio
    async def test_sync_updates_existing_market(self):
        """Should update an existing PocketBase record."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[{"id": "existing_id"}])
        mock_pb.update_record = AsyncMock(return_value={"id": "existing_id"})

        service = MarketDiscoveryService(mock_pb)
        markets = [{
            "polymarket_id": "cond_123",
            "question": "Will X happen?",
            "current_prices": {"yes": 0.7, "no": 0.3},
            "volume": 8000,
            "liquidity": 2000,
            "status": "active",
            "end_date": "",
            "asset_id": "token_abc",
        }]

        synced = await service._sync_to_pocketbase(markets)
        assert len(synced) == 1
        assert synced[0]["id"] == "existing_id"
        mock_pb.update_record.assert_called_once()

    @pytest.mark.asyncio
    async def test_sync_handles_failure_gracefully(self):
        """Should skip markets that fail to sync."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(side_effect=Exception("DB error"))

        service = MarketDiscoveryService(mock_pb)
        markets = [{
            "polymarket_id": "cond_fail",
            "question": "Fail?",
            "current_prices": {"yes": 0.5, "no": 0.5},
            "volume": 1000,
            "liquidity": 0,
            "status": "active",
            "end_date": "",
            "asset_id": "token_fail",
        }]

        synced = await service._sync_to_pocketbase(markets)
        assert len(synced) == 0

    @pytest.mark.asyncio
    async def test_load_from_pocketbase(self):
        """Should load cached markets from PocketBase."""
        mock_pb = AsyncMock()
        mock_pb.list_records = AsyncMock(return_value=[
            {"id": "1", "polymarket_id": "abc", "status": "active"},
            {"id": "2", "polymarket_id": "def", "status": "active"},
        ])

        service = MarketDiscoveryService(mock_pb)
        markets = await service._load_from_pocketbase()
        assert len(markets) == 2
