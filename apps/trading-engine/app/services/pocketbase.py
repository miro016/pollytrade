from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


class PocketBaseClient:
    """Async PocketBase client using httpx for direct REST API access."""

    def __init__(self, base_url: str = "http://localhost:8090"):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=10.0)
        self._auth_token: str | None = None

    async def health_check(self) -> bool:
        """Check if PocketBase is healthy."""
        try:
            resp = await self._client.get("/api/health")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def authenticate(self, email: str, password: str) -> str:
        """Authenticate as admin and store token."""
        resp = await self._client.post(
            "/api/collections/_superusers/auth-with-password",
            json={"identity": email, "password": password},
        )
        resp.raise_for_status()
        data = resp.json()
        self._auth_token = data["token"]
        return self._auth_token

    def _headers(self) -> dict[str, str]:
        """Build request headers with auth token if available."""
        headers = {"Content-Type": "application/json"}
        if self._auth_token:
            headers["Authorization"] = self._auth_token
        return headers

    async def list_records(
        self,
        collection: str,
        *,
        page: int = 1,
        per_page: int = 30,
        sort: str = "-created",
        filter_str: str = "",
    ) -> list[dict[str, Any]]:
        """List records from a collection."""
        params: dict[str, Any] = {
            "page": page,
            "perPage": per_page,
            "sort": sort,
        }
        if filter_str:
            params["filter"] = filter_str

        resp = await self._client.get(
            f"/api/collections/{collection}/records",
            params=params,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json().get("items", [])

    async def get_record(self, collection: str, record_id: str) -> dict[str, Any]:
        """Get a single record by ID."""
        resp = await self._client.get(
            f"/api/collections/{collection}/records/{record_id}",
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def create_record(
        self,
        collection: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a new record."""
        resp = await self._client.post(
            f"/api/collections/{collection}/records",
            json=data,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def update_record(
        self,
        collection: str,
        record_id: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing record."""
        resp = await self._client.patch(
            f"/api/collections/{collection}/records/{record_id}",
            json=data,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def delete_record(self, collection: str, record_id: str) -> bool:
        """Delete a record."""
        resp = await self._client.delete(
            f"/api/collections/{collection}/records/{record_id}",
            headers=self._headers(),
        )
        return resp.status_code == 204

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
