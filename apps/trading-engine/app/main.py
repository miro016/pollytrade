import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import structlog
from fastapi import FastAPI

from app.config import settings
from app.services.pocketbase import PocketBaseClient

logger = structlog.get_logger()

pb_client = PocketBaseClient(settings.pb_url)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info(
        "trading_engine_starting",
        mode=settings.trading_mode,
        pb_url=settings.pb_url,
    )

    # Verify PocketBase connection
    healthy = await pb_client.health_check()
    if healthy:
        logger.info("pocketbase_connected")
    else:
        logger.warning("pocketbase_unavailable", url=settings.pb_url)

    # Update bot status
    await _update_bot_status(running=True)

    yield

    # Shutdown
    logger.info("trading_engine_stopping")
    await _update_bot_status(running=False)
    await pb_client.close()


async def _update_bot_status(running: bool) -> None:
    """Update bot status in PocketBase."""
    try:
        records = await pb_client.list_records("bot_status", per_page=1)
        if records:
            await pb_client.update_record("bot_status", records[0]["id"], {
                "running": running,
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        logger.warning("bot_status_update_failed", error=str(e))


app = FastAPI(
    title="Polymarket Trading Engine",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    pb_healthy = await pb_client.health_check()
    return {
        "status": "healthy",
        "mode": settings.trading_mode,
        "pocketbase": "connected" if pb_healthy else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/status")
async def status():
    """Get current trading engine status."""
    try:
        records = await pb_client.list_records("bot_status", per_page=1)
        if records:
            return records[0]
    except Exception:
        pass
    return {"running": False, "error": "Unable to fetch status"}
