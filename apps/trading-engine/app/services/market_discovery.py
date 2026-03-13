import structlog

from app.services.pocketbase import PocketBaseClient

logger = structlog.get_logger()


class MarketDiscoveryService:
    """Discovers active Polymarket markets and syncs them to PocketBase."""

    def __init__(
        self,
        pb_client: PocketBaseClient,
        min_volume: float = 1000.0,
        max_markets: int = 50,
    ):
        self.pb = pb_client
        self.min_volume = min_volume
        self.max_markets = max_markets

    async def discover_and_sync(self) -> list[dict]:
        """Fetch active markets from Polymarket CLOB API and sync to PocketBase.

        Returns list of market dicts with asset_ids for WebSocket subscription.
        """
        try:
            markets = await self._fetch_polymarket_markets()
            synced = await self._sync_to_pocketbase(markets)
            logger.info("market_discovery_complete", discovered=len(markets), synced=len(synced))
            return synced
        except Exception as e:
            logger.error("market_discovery_failed", error=str(e))
            return await self._load_from_pocketbase()

    async def _fetch_polymarket_markets(self) -> list[dict]:
        """Fetch markets from the Polymarket CLOB REST API."""
        import httpx

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://clob.polymarket.com/markets",
                params={"active": "true", "closed": "false"},
            )
            resp.raise_for_status()
            data = resp.json()

        markets = []
        for market in data if isinstance(data, list) else data.get("data", []):
            volume = float(market.get("volume", 0) or 0)
            if volume < self.min_volume:
                continue

            tokens = market.get("tokens", [])
            yes_price = 0.5
            no_price = 0.5
            yes_asset_id = ""
            for token in tokens:
                if token.get("outcome", "").lower() == "yes":
                    yes_price = float(token.get("price", 0.5))
                    yes_asset_id = token.get("token_id", "")
                elif token.get("outcome", "").lower() == "no":
                    no_price = float(token.get("price", 0.5))

            if not yes_asset_id:
                continue

            markets.append({
                "polymarket_id": market.get("condition_id", ""),
                "question": market.get("question", "")[:1000],
                "current_prices": {"yes": yes_price, "no": no_price},
                "volume": volume,
                "liquidity": float(market.get("rewards", {}).get("liquidity", 0) or 0),
                "status": "active",
                "end_date": market.get("end_date_iso", ""),
                "asset_id": yes_asset_id,
            })

        markets.sort(key=lambda m: m["volume"], reverse=True)
        return markets[: self.max_markets]

    async def _sync_to_pocketbase(self, markets: list[dict]) -> list[dict]:
        """Sync discovered markets to PocketBase, creating or updating records."""
        synced = []
        for market in markets:
            asset_id = market.pop("asset_id", "")
            try:
                existing = await self.pb.list_records(
                    "markets",
                    filter_str=f'polymarket_id = "{market["polymarket_id"]}"',
                    per_page=1,
                )
                if existing:
                    await self.pb.update_record("markets", existing[0]["id"], {
                        "current_prices": market["current_prices"],
                        "volume": market["volume"],
                        "status": market["status"],
                    })
                    market["id"] = existing[0]["id"]
                else:
                    record = await self.pb.create_record("markets", market)
                    market["id"] = record["id"]

                market["asset_id"] = asset_id
                synced.append(market)
            except Exception as e:
                logger.warning("market_sync_failed", polymarket_id=market.get("polymarket_id"), error=str(e))

        return synced

    async def _load_from_pocketbase(self) -> list[dict]:
        """Fallback: load existing markets from PocketBase."""
        try:
            records = await self.pb.list_records(
                "markets",
                filter_str='status = "active"',
                per_page=self.max_markets,
                sort="-volume",
            )
            logger.info("loaded_markets_from_cache", count=len(records))
            return records
        except Exception as e:
            logger.error("pocketbase_load_failed", error=str(e))
            return []

    async def get_asset_ids(self) -> list[str]:
        """Get list of YES token asset IDs for WebSocket subscription."""
        markets = await self.discover_and_sync()
        return [m["asset_id"] for m in markets if m.get("asset_id")]
