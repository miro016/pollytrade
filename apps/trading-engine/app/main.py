import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import structlog
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.engine import TradingEngine
from app.services.pocketbase import PocketBaseClient

logger = structlog.get_logger()

pb_client = PocketBaseClient(settings.pb_url)
engine = TradingEngine(pb_client)


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
        # Auto-start engine
        asyncio.create_task(engine.start())
    else:
        logger.warning("pocketbase_unavailable", url=settings.pb_url)

    yield

    # Shutdown
    logger.info("trading_engine_stopping")
    await engine.stop()
    await pb_client.close()


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
        "engine_running": engine.running,
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


@app.post("/control/start")
async def control_start():
    """Start the trading engine."""
    if engine.running:
        return {"message": "Engine already running"}
    asyncio.create_task(engine.start())
    return {"message": "Engine starting"}


@app.post("/control/stop")
async def control_stop():
    """Stop the trading engine."""
    if not engine.running:
        return {"message": "Engine already stopped"}
    await engine.stop()
    return {"message": "Engine stopped"}


class ModeRequest(BaseModel):
    mode: str


@app.post("/control/mode")
async def control_mode(req: ModeRequest):
    """Switch trading mode (paper/live)."""
    if req.mode not in ("paper", "live"):
        raise HTTPException(status_code=400, detail="Mode must be 'paper' or 'live'")
    if req.mode == "live":
        raise HTTPException(status_code=403, detail="Live trading not yet enabled")
    settings.trading_mode = req.mode
    return {"message": f"Mode set to {req.mode}"}
