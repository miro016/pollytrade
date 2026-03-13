from __future__ import annotations

import asyncio
from typing import Callable, Optional

import structlog

logger = structlog.get_logger()


async def market_data_consumer(
    queue: asyncio.Queue,
    on_price_update: Optional[Callable] = None,
) -> None:
    """Consume market data from the WebSocket queue and dispatch to handlers.

    Processes events sequentially to prevent strategy logic from
    receiving stale data.
    """
    logger.info("consumer_starting")

    while True:
        try:
            data = await queue.get()
            event_type = data.get("event_type", "unknown")

            if event_type == "price_change":
                await _handle_price_change(data, on_price_update)
            elif event_type == "last_trade_price":
                await _handle_last_trade(data)
            elif event_type == "book":
                await _handle_book_update(data)
            elif event_type == "best_bid_ask":
                await _handle_best_bid_ask(data)
            else:
                logger.debug("consumer_unknown_event", event_type=event_type)

            queue.task_done()

        except Exception as e:
            logger.error("consumer_error", error=str(e))


async def _handle_price_change(data: dict, callback: Optional[Callable] = None) -> None:
    """Handle price change events."""
    asset_id = data.get("asset_id")
    price = data.get("price")
    if asset_id and price is not None:
        logger.debug("price_change", asset_id=asset_id, price=price)
        if callback:
            await callback(asset_id, float(price))


async def _handle_last_trade(data: dict) -> None:
    """Handle last trade price events."""
    logger.debug("last_trade", asset_id=data.get("asset_id"), price=data.get("price"))


async def _handle_book_update(data: dict) -> None:
    """Handle order book updates."""
    logger.debug("book_update", asset_id=data.get("asset_id"))


async def _handle_best_bid_ask(data: dict) -> None:
    """Handle best bid/ask updates."""
    logger.debug("best_bid_ask", asset_id=data.get("asset_id"))
