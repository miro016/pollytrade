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


class StrategyInstance:
    """A single strategy with its own signal generator, risk gate, and paper adapter."""

    def __init__(self, config: dict, initial_balance: float):
        self.name: str = config.get("name", "Unknown")
        self.record_id: str = config.get("id", "")
        params = config.get("parameters", {})
        indicators = params.get("indicators", {})

        self.signal_gen = SignalGenerator(config=indicators)
        self.min_confidence = params.get("min_confidence", 0.5)
        self.min_edge = params.get("min_edge", 0.02)

        self.risk_gate = RiskManagementGate(
            max_daily_drawdown=settings.max_daily_drawdown,
            max_total_drawdown=settings.max_total_drawdown,
            kelly_fraction=settings.kelly_fraction,
            max_position_size=settings.max_position_size,
            min_edge=self.min_edge,
            circuit_breaker=CircuitBreaker(
                daily_loss_limit=settings.circuit_breaker_daily_loss,
                weekly_loss_limit=settings.circuit_breaker_weekly_loss,
                max_consecutive_losses=settings.circuit_breaker_consecutive_losses,
                timeout_seconds=settings.circuit_breaker_timeout_seconds,
            ),
        )
        self.adapter = PaperTradingAdapter(initial_balance=initial_balance)

        # Indicator config for signal generation
        self.zscore_config = indicators.get("zscore", {})
        self.entropy_config = indicators.get("entropy", {})
        self.garch_config = indicators.get("garch", {})
        self.rsi_config = indicators.get("rsi", {})


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
        self.strategies: list[StrategyInstance] = []

        # Legacy single-adapter for portfolio snapshots fallback
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

        # Load all active strategies
        await self._load_strategies()

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

        strategy_names = [s.name for s in self.strategies]
        await self._update_bot_status(
            running=True,
            markets_monitored=len(self._markets),
            current_strategy=", ".join(strategy_names) if strategy_names else "None",
        )
        logger.info(
            "engine_started",
            markets=len(self._markets),
            assets=len(asset_ids),
            strategies=len(self.strategies),
        )

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
        for market in self._markets:
            if market.get("asset_id") == asset_id:
                market_id = market.get("polymarket_id", asset_id)

                # Update price on all strategy adapters
                for strategy in self.strategies:
                    strategy.adapter.update_market_price(market_id, price)
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
        """Analyze all tracked markets with each active strategy."""
        for strategy in self.strategies:
            await self._run_strategy(strategy)

    async def _run_strategy(self, strategy: StrategyInstance) -> None:
        """Run a single strategy against all markets."""
        balance = await strategy.adapter.get_balance()
        daily_pnl_pct = 0.0
        peak_balance = settings.paper_balance

        for market in self._markets:
            market_id = market.get("polymarket_id", "")
            prices = self._price_history.get(market_id, [])

            if len(prices) < 10:
                continue

            price_series = pd.Series(prices)
            current_price = prices[-1]

            # Generate signals using strategy-specific config
            signals = []
            weights = {}

            zscore_cfg = strategy.zscore_config
            if zscore_cfg.get("enabled", True):
                try:
                    zscore_sig = strategy.signal_gen.generate_zscore_signal(
                        price_series,
                        window=zscore_cfg.get("window", 30),
                        threshold=zscore_cfg.get("threshold", 2.0),
                    )
                    signals.append(zscore_sig)
                    weights["zscore"] = zscore_cfg.get("weight", 0.3)
                except Exception:
                    pass

            entropy_cfg = strategy.entropy_config
            if entropy_cfg.get("enabled", True):
                try:
                    entropy_sig = strategy.signal_gen.generate_entropy_signal(current_price)
                    signals.append(entropy_sig)
                    weights["entropy"] = entropy_cfg.get("weight", 0.2)
                except Exception:
                    pass

            garch_cfg = strategy.garch_config
            if garch_cfg.get("enabled", True) and len(prices) > 30:
                try:
                    returns = price_series.pct_change().dropna()
                    if len(returns) > 20:
                        garch_sig = strategy.signal_gen.generate_garch_signal(returns)
                        signals.append(garch_sig)
                        weights["garch"] = garch_cfg.get("weight", 0.3)
                except Exception:
                    pass

            if not signals:
                continue

            # Composite signal
            composite = strategy.signal_gen.generate_composite_signal(signals, weights)

            # Persist signals to PocketBase
            for sig in signals + [composite]:
                await self._save_signal(market_id, sig, strategy.name)

            # Only act on composite signals
            if composite.direction == Direction.HOLD:
                continue
            if composite.confidence < strategy.min_confidence:
                continue

            # Evaluate through risk gate
            proposal = TradeProposal(
                market_id=market_id,
                direction=composite.direction.value,
                estimated_probability=composite.confidence,
                market_price=current_price,
                bankroll=balance,
            )

            gate_result: GateResult = strategy.risk_gate.evaluate(
                proposal, daily_pnl_pct, 0.0, peak_balance=peak_balance,
            )

            if not gate_result.approved:
                logger.debug(
                    "trade_rejected",
                    market=market_id,
                    strategy=strategy.name,
                    reason=gate_result.rejection_reason,
                )
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

            result = await strategy.adapter.place_order(order)
            if result.success:
                await self._save_trade(market_id, order, result, composite, strategy.name)
                logger.info(
                    "trade_executed",
                    market=market_id,
                    strategy=strategy.name,
                    side=side.value,
                    amount=gate_result.position_size,
                    price=result.filled_price,
                )

    async def _save_signal(self, market_id: str, signal, strategy_name: str = "") -> None:
        """Persist a signal to PocketBase."""
        try:
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
                "metadata": {**signal.metadata, "strategy": strategy_name},
            })
        except Exception as e:
            logger.debug("signal_save_failed", error=str(e))

    async def _save_trade(self, market_id, order, result, signal, strategy_name: str) -> None:
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
                "strategy": strategy_name,
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
                total_positions = 0
                for strategy in self.strategies:
                    positions = await strategy.adapter.get_positions()
                    total_positions += len(positions)
                await self._update_bot_status(
                    running=True,
                    markets_monitored=len(self._markets),
                    active_positions=total_positions,
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
        """Persist current portfolio state to PocketBase (aggregate across strategies)."""
        try:
            total_balance = 0.0
            all_positions = []

            for strategy in self.strategies:
                balance = await strategy.adapter.get_balance()
                total_balance += balance
                positions = await strategy.adapter.get_positions()
                for p in positions:
                    all_positions.append({
                        "market_id": p.market_id,
                        "token": p.token.value if hasattr(p.token, "value") else p.token,
                        "quantity": p.quantity,
                        "avg_price": p.avg_price,
                        "current_price": p.current_price,
                        "unrealized_pnl": p.unrealized_pnl,
                        "strategy": strategy.name,
                    })

            if not self.strategies:
                total_balance = await self.adapter.get_balance()

            total_initial = settings.paper_balance * max(len(self.strategies), 1)
            total_value = total_balance + sum(
                p["quantity"] * p["current_price"] for p in all_positions
            )
            pnl = total_value - total_initial
            peak = max(total_value, total_initial)

            records = await self.pb.list_records("portfolio", per_page=1, sort="-created")
            if records:
                old_peak = records[0].get("peak_balance", total_initial)
                peak = max(peak, old_peak)
                await self.pb.update_record("portfolio", records[0]["id"], {
                    "balance": total_balance,
                    "positions": all_positions,
                    "total_pnl": pnl,
                    "peak_balance": peak,
                    "mode": settings.trading_mode,
                })
            else:
                await self.pb.create_record("portfolio", {
                    "balance": total_balance,
                    "positions": all_positions,
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

    async def _load_strategies(self) -> None:
        """Load all active strategy configs from PocketBase."""
        self.strategies = []
        try:
            configs = await self.pb.list_records(
                "strategy_configs", filter_str="active = true", per_page=100,
            )
            for cfg in configs:
                instance = StrategyInstance(cfg, settings.paper_balance)
                self.strategies.append(instance)
                logger.info("strategy_loaded", name=instance.name)

            if not self.strategies:
                logger.warning("no_active_strategies")
        except Exception as e:
            logger.warning("strategy_load_failed", error=str(e))

    async def _load_strategy_config(self) -> None:
        """Load active strategy config (legacy single-strategy compat)."""
        await self._load_strategies()
