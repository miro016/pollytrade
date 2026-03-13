import asyncio
import json

import structlog
import websockets

logger = structlog.get_logger()

WS_URI = "wss://ws-subscriptions-clob.polymarket.com/ws/market"


async def polymarket_stream(
    asset_ids: list[str],
    queue: asyncio.Queue,
    *,
    ping_interval: int = 10,
    ping_timeout: int = 20,
) -> None:
    """Connect to Polymarket WebSocket and stream market data into a queue.

    Auto-reconnects on connection loss via the websockets library's
    built-in reconnection pattern.
    """
    logger.info("ws_stream_starting", asset_count=len(asset_ids))

    async for ws in websockets.connect(
        WS_URI,
        ping_interval=ping_interval,
        ping_timeout=ping_timeout,
    ):
        try:
            # Subscribe to market data for specified assets
            subscribe_msg = json.dumps({
                "assets_ids": asset_ids,
                "type": "market",
            })
            await ws.send(subscribe_msg)
            logger.info("ws_subscribed", assets=len(asset_ids))

            async for message in ws:
                if message == "PONG":
                    continue
                try:
                    data = json.loads(message)
                    await queue.put(data)
                except json.JSONDecodeError:
                    logger.warning("ws_invalid_json", message=message[:100])

        except websockets.ConnectionClosed as e:
            logger.warning("ws_connection_closed", code=e.code, reason=e.reason)
            continue  # auto-reconnects
        except Exception as e:
            logger.error("ws_unexpected_error", error=str(e))
            await asyncio.sleep(1)
            continue
