import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from app.main import app


class TestHealthEndpoint:
    def test_health_returns_200(self):
        with patch("app.main.pb_client") as mock_pb:
            mock_pb.health_check = AsyncMock(return_value=True)
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "mode" in data
            assert "timestamp" in data

    def test_health_shows_disconnected_pb(self):
        with patch("app.main.pb_client") as mock_pb:
            mock_pb.health_check = AsyncMock(return_value=False)
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["pocketbase"] == "disconnected"


class TestStatusEndpoint:
    def test_status_returns_data(self):
        mock_record = {
            "id": "test123",
            "running": True,
            "current_strategy": "Conservative",
            "risk_state": "normal",
        }
        with patch("app.main.pb_client") as mock_pb:
            mock_pb.list_records = AsyncMock(return_value=[mock_record])
            mock_pb.health_check = AsyncMock(return_value=True)
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/status")
            assert response.status_code == 200

    def test_status_handles_error(self):
        with patch("app.main.pb_client") as mock_pb:
            mock_pb.list_records = AsyncMock(side_effect=Exception("connection failed"))
            mock_pb.health_check = AsyncMock(return_value=False)
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/status")
            assert response.status_code == 200
            data = response.json()
            assert data["running"] is False
