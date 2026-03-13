import asyncio
from datetime import datetime, timezone

import pandas as pd
import structlog

from app.config import settings
from app.risk.circuit_breaker import CircuitBreaker
from app.risk.gate import GateResult, RiskManagementGate, TradeProposal
from app.services.market_discovery import MarketDiscoveryService
from app.services.pocketbase import PocketBaseClient
from app.signals.generator import Direction, SignalGenerator
from app.trading.adapter import Order, OrderSide, TokenType
from app.trading.paper import PaperTradingAdapter
from app.ws.consumer import market_data_consumer
from app.ws.polymarket_stream import polymarket_stream

logger = structlog.get_logger()


class TradingEngine:
    """Main orchestrator that ties together market data, signals, risk, and trading."""

    def __init__(self, pb_client: PocketBaseClient):
        self.pb = pb_client
        self.running = False
        self._tasks: list[asyncio.Task] = []
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=1000)

        # Price history per market (market_id -> list of prices)
        self._price_history: dict[str, list[float]] = {}
        self._markets: list[dict] = []

        # Components
        self.discovery = MarketDiscoveryService(pb_client)
        self.signal_gen = SignalGenerator()
        self.risk_gate = RiskManagementGate(
            max_daily_drawdown=settings.max_daily_drawdown,
            max_total_drawdown=settings.max_total_drawdown,
            kelly_fraction=settings.kelly_fraction,
            max_position_size=settings.max_position_size,
            min_edge=settings.min_edge,
            circuit_breaker=CircuitBreaker(
                daily_loss_limit=settings.circuit_breaker_daily_loss,
                weekly_loss_limit=settings.circuit_breaker_weekly_loss,
                max_consecutive_losses=settings.circuit_breaker_consecutive_losses,
                timeout_seconds=settings.circuit_breaker_timeout_seconds,
            ),
        )
        self.adapter = PaperTradingAdapter(initial_balance=settings.paper_balance)

    async def start(self) -> None:
        """Start the trading engine."""
        if self.running:
            logger.warning("engine_already_running")
            return

        self.running = True
        logger.info("engine_starting", mode=settings.trading_mode)

        # Authenticate with PocketBase
        try:
            await self.pb.authenticate(settings.pb_admin_email, settings.pb_admin_password)
            logger.info("pocketbase_authenticated")
        except Exception as e:
            logger.error("pocketbase_auth_failed", error=str(e))

        # Load strategy config
        await self._load_strategy_config()

        # Discover markets
        self._markets = await self.discovery.discover_and_sync()
        asset_ids = [m.get("asset_id", "") for m in self._markets if m.get("asset_id")]

        if asset_ids:
            # Start WebSocket stream
            self._tasks.append(
                asyncio.create_task(polymarket_stream(asset_ids, self._queue))
            )
            # Start data consumer
            self._tasks.append(
                asyncio.create_task(market_data_consumer(self._queue, self._on_price_update))
            )

        # Start main processing loop
        self._tasks.append(asyncio.create_task(self._processing_loop()))
        # Start heartbeat
        self._tasks.append(asyncio.create_task(self._heartbeat_loop()))
        # Start portfolio snapshot
        self._tasks.append(asyncio.create_task(self._snapshot_loop()))

        await self._update_bot_status(running=True, markets_monitored=len(self._markets))
        logger.info("engine_started", markets=len(self._markets), assets=len(asset_ids))

    async def stop(self) -> None:
        """Graceful shutdown."""
        if not self.running:
            return

        self.running = False
        logger.info("engine_stopping")

        for task in self._tasks:
            task.cancel()

        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

        # Final portfolio snapshot
        await self._save_portfolio_snapshot()
        await self._update_bot_status(running=False)
        logger.info("engine_stopped")

    async def _on_price_update(self, asset_id: str, price: float) -> None:
        """Callback from WebSocket consumer on price changes."""
        # Find which market this asset belongs to
        for market in self._markets:
            if market.get("asset_id") == asset_id:
                market_id = market.get("polymarket_id", asset_id)
                self.adapter.update_market_price(market_id, price)

                if market_id not in self._price_history:
                    self._price_history[market_id] = []
                self._price_history[market_id].append(price)

                # Keep last 500 prices
                if len(self._price_history[market_id]) > 500:
                    self._price_history[market_id] = self._price_history[market_id][-500:]

                # Update PocketBase market record
                try:
                    existing = await self.pb.list_records(
                        "markets",
                        filter_str=f'polymarket_id = "{market_id}"',
                        per_page=1,
                    )
                    if existing:
                        await self.pb.update_record("markets", existing[0]["id"], {
                            "current_prices": {"yes": price, "no": round(1 - price, 4)},
                        })
                except Exception:
                    pass
                break

    async def _processing_loop(self) -> None:
        """Main analysis loop — runs every 60 seconds."""
        while self.running:
            try:
                await self._analyze_markets()
            except Exception as e:
                logger.error("processing_error", error=str(e))
            await asyncio.sleep(60)

    async def _analyze_markets(self) -> None:
        """Analyze all tracked markets, generate signals, evaluate trades."""
        balance = await self.adapter.get_balance()
        positions = await self.adapter.get_positions()
        daily_pnl_pct = 0.0
        peak_balance = settings.paper_balance

        # Load portfolio for drawdown calculations
        try:
            portfolio_records = await self.pb.list_records("portfolio", per_page=1, sort="-created")
            if portfolio_records:
                port = portfolio_records[0]
                peak_balance = port.get("peak_balance", settings.paper_balance)
                daily_pnl_pct = port.get("daily_pnl", 0) / max(peak_balance, 1)
        except Exception:
            pass

        for market in self._markets:
            market_id = market.get("polymarket_id", "")
            prices = self._price_history.get(market_id, [])

            if len(prices) < 10:
                continue

            price_series = pd.Series(prices)
            current_price = prices[-1]

            # Generate signals
            signals = []
            weights = {}

            try:
                zscore_sig = self.signal_gen.generate_zscore_signal(price_series)
                signals.append(zscore_sig)
                weights["zscore"] = 0.3
            except Exception:
                pass

            try:
                entropy_sig = self.signal_gen.generate_entropy_signal(current_price)
                signals.append(entropy_sig)
                weights["entropy"] = 0.2
            except Exception:
                pass

            if len(prices) > 30:
                try:
                    returns = price_series.pct_change().dropna()
                    if len(returns) > 20:
                        garch_sig = self.signal_gen.generate_garch_signal(returns)
                        signals.append(garch_sig)
                        weights["garch"] = 0.3
                except Exception:
                    pass

            # Composite signal
            composite = self.signal_gen.generate_composite_signal(signals, weights)

            # Persist signals to PocketBase
            for sig in signals + [composite]:
                await self._save_signal(market_id, sig)

            # Only act on composite signals
            if composite.direction == Direction.HOLD or composite.confidence < 0.3:
                continue

            # Evaluate through risk gate
            proposal = TradeProposal(
                market_id=market_id,
                direction=composite.direction.value,
                estimated_probability=composite.confidence,
                market_price=current_price,
                bankroll=balance,
            )

            gate_result: GateResult = self.risk_gate.evaluate(
                proposal, daily_pnl_pct, 0.0, peak_balance=peak_balance,
            )

            if not gate_result.approved:
                logger.debug("trade_rejected", market=market_id, reason=gate_result.rejection_reason)
                continue

            # Execute trade
            side = OrderSide.BUY if composite.direction == Direction.BUY else OrderSide.SELL
            order = Order(
                market_id=market_id,
                side=side,
                token=TokenType.YES,
                amount=gate_result.position_size,
                price=current_price,
            )

            result = await self.adapter.place_order(order)
            if result.success:
                await self._save_trade(market_id, order, result, composite)
                logger.info(
                    "trade_executed",
                    market=market_id,
                    side=side.value,
                    amount=gate_result.position_size,
                    price=result.filled_price,
                )

    async def _save_signal(self, market_id: str, signal) -> None:
        """Persist a signal to PocketBase."""
        try:
            # Look up market record ID
            existing = await self.pb.list_records(
                "markets", filter_str=f'polymarket_id = "{market_id}"', per_page=1,
            )
            if not existing:
                return

            await self.pb.create_record("signals", {
                "market_id": existing[0]["id"],
                "signal_type": signal.signal_type,
                "direction": signal.direction.value,
                "value": signal.value,
                "confidence": signal.confidence,
                "metadata": signal.metadata,
            })
        except Exception as e:
            logger.debug("signal_save_failed", error=str(e))

    async def _save_trade(self, market_id, order, result, signal) -> None:
        """Persist a trade to PocketBase."""
        try:
            existing = await self.pb.list_records(
                "markets", filter_str=f'polymarket_id = "{market_id}"', per_page=1,
            )
            if not existing:
                return

            await self.pb.create_record("trades", {
                "market_id": existing[0]["id"],
                "side": order.side.value,
                "token": order.token.value,
                "amount": order.amount,
                "price": result.filled_price,
                "strategy": f"composite_{signal.signal_type}",
                "mode": settings.trading_mode,
                "fees": result.fees,
                "slippage": result.slippage,
            })
        except Exception as e:
            logger.warning("trade_save_failed", error=str(e))

    async def _heartbeat_loop(self) -> None:
        """Update bot_status every 30 seconds."""
        while self.running:
            try:
                positions = await self.adapter.get_positions()
                await self._update_bot_status(
                    running=True,
                    markets_monitored=len(self._markets),
                    active_positions=len(positions),
                )
            except Exception as e:
                logger.debug("heartbeat_failed", error=str(e))
            await asyncio.sleep(30)

    async def _snapshot_loop(self) -> None:
        """Save portfolio snapshot every 5 minutes."""
        while self.running:
            await asyncio.sleep(300)
            await self._save_portfolio_snapshot()

    async def _save_portfolio_snapshot(self) -> None:
        """Persist current portfolio state to PocketBase."""
        try:
            balance = await self.adapter.get_balance()
            positions = await self.adapter.get_positions()
            pos_data = [
                {
                    "market_id": p.market_id,
                    "token": p.token.value if hasattr(p.token, "value") else p.token,
                    "quantity": p.quantity,
                    "avg_price": p.avg_price,
                    "current_price": p.current_price,
                    "unrealized_pnl": p.unrealized_pnl,
                }
                for p in positions
            ]

            # Calculate totals
            total_value = balance + sum(p.quantity * p.current_price for p in positions)
            pnl = total_value - settings.paper_balance
            peak = max(total_value, settings.paper_balance)

            records = await self.pb.list_records("portfolio", per_page=1, sort="-created")
            if records:
                old_peak = records[0].get("peak_balance", settings.paper_balance)
                peak = max(peak, old_peak)
                await self.pb.update_record("portfolio", records[0]["id"], {
                    "balance": balance,
                    "positions": pos_data,
                    "total_pnl": pnl,
                    "peak_balance": peak,
                    "mode": settings.trading_mode,
                })
            else:
                await self.pb.create_record("portfolio", {
                    "balance": balance,
                    "positions": pos_data,
                    "daily_pnl": 0,
                    "total_pnl": pnl,
                    "win_rate": 0,
                    "total_trades": 0,
                    "mode": settings.trading_mode,
                    "peak_balance": peak,
                })
        except Exception as e:
            logger.warning("portfolio_snapshot_failed", error=str(e))

    async def _update_bot_status(self, **fields) -> None:
        """Update bot_status record in PocketBase."""
        try:
            fields["last_heartbeat"] = datetime.now(timezone.utc).isoformat()
            records = await self.pb.list_records("bot_status", per_page=1)
            if records:
                await self.pb.update_record("bot_status", records[0]["id"], fields)
            else:
                fields.setdefault("running", False)
                fields.setdefault("current_strategy", "Conservative")
                fields.setdefault("risk_state", "normal")
                fields.setdefault("circuit_breaker_state", "closed")
                await self.pb.create_record("bot_status", fields)
        except Exception as e:
            logger.warning("bot_status_update_failed", error=str(e))

    async def _load_strategy_config(self) -> None:
        """Load active strategy config from PocketBase."""
        try:
            configs = await self.pb.list_records(
                "strategy_configs", filter_str='active = true', per_page=1,
            )
            if configs:
                params = configs[0].get("parameters", {})
                indicators = params.get("indicators", {})
                self.signal_gen.config = indicators
                logger.info("strategy_config_loaded", name=configs[0].get("name"))
        except Exception as e:
            logger.debug("strategy_config_load_failed", error=str(e))
