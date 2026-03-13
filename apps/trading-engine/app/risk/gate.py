import time
from dataclasses import dataclass, field

import structlog

from app.risk.circuit_breaker import CircuitBreaker
from app.risk.kelly import KellyResult, kelly_criterion

logger = structlog.get_logger()


@dataclass
class TradeProposal:
    market_id: str
    direction: str  # buy or sell
    estimated_probability: float
    market_price: float
    bankroll: float


@dataclass
class GateResult:
    approved: bool
    position_size: float  # Dollar amount
    kelly: KellyResult | None = None
    rejection_reason: str = ""


@dataclass
class RiskManagementGate:
    """Layered risk gate that every trade proposal must pass through.

    Checks in order:
    1. Daily/total drawdown limits
    2. Circuit breaker state
    3. Consecutive loss cooldown (exponential backoff)
    4. Kelly criterion position sizing
    """

    max_daily_drawdown: float = 0.05
    max_total_drawdown: float = 0.15
    kelly_fraction: float = 0.5
    max_position_size: float = 0.10
    min_edge: float = 0.02
    cooldown_base_seconds: float = 60.0
    cooldown_max_seconds: float = 3600.0

    circuit_breaker: CircuitBreaker = field(default_factory=CircuitBreaker)
    _last_loss_time: float = 0.0
    _consecutive_losses: int = 0

    def evaluate(
        self,
        proposal: TradeProposal,
        daily_pnl_pct: float,
        total_pnl_pct: float,
        weekly_pnl_pct: float = 0.0,
        peak_balance: float | None = None,
    ) -> GateResult:
        """Evaluate a trade proposal through all risk gates."""

        # 1. Drawdown check
        if daily_pnl_pct <= -self.max_daily_drawdown:
            return GateResult(
                approved=False,
                position_size=0.0,
                rejection_reason=f"daily_drawdown_{daily_pnl_pct:.2%}",
            )

        if peak_balance and proposal.bankroll > 0:
            drawdown_from_peak = (peak_balance - proposal.bankroll) / peak_balance
            if drawdown_from_peak >= self.max_total_drawdown:
                return GateResult(
                    approved=False,
                    position_size=0.0,
                    rejection_reason=f"total_drawdown_{drawdown_from_peak:.2%}",
                )

        # 2. Circuit breaker
        self.circuit_breaker.check_and_update(daily_pnl_pct, weekly_pnl_pct)
        if not self.circuit_breaker.can_trade():
            return GateResult(
                approved=False,
                position_size=0.0,
                rejection_reason="circuit_breaker_open",
            )

        # 3. Cooldown check (exponential backoff after losses)
        if self._consecutive_losses >= 2:
            cooldown = min(
                self.cooldown_base_seconds * (2 ** (self._consecutive_losses - 2)),
                self.cooldown_max_seconds,
            )
            elapsed = time.time() - self._last_loss_time
            if elapsed < cooldown:
                remaining = cooldown - elapsed
                return GateResult(
                    approved=False,
                    position_size=0.0,
                    rejection_reason=f"cooldown_{remaining:.0f}s_remaining",
                )

        # 4. Kelly criterion
        kelly_result = kelly_criterion(
            estimated_probability=proposal.estimated_probability,
            market_price=proposal.market_price,
            kelly_fraction=self.kelly_fraction,
            max_position=self.max_position_size,
            min_edge=self.min_edge,
        )

        if not kelly_result.should_trade:
            return GateResult(
                approved=False,
                position_size=0.0,
                kelly=kelly_result,
                rejection_reason=f"insufficient_edge_{kelly_result.edge:.4f}",
            )

        # Apply circuit breaker size multiplier
        cb_multiplier = self.circuit_breaker.get_size_multiplier()
        position_fraction = kelly_result.capped * cb_multiplier
        position_size = position_fraction * proposal.bankroll

        logger.info(
            "trade_approved",
            market_id=proposal.market_id,
            direction=proposal.direction,
            position_size=position_size,
            kelly_fraction=kelly_result.capped,
            cb_multiplier=cb_multiplier,
            edge=kelly_result.edge,
        )

        return GateResult(
            approved=True,
            position_size=position_size,
            kelly=kelly_result,
        )

    def record_result(self, is_win: bool) -> None:
        """Record a trade result for cooldown and circuit breaker tracking."""
        self.circuit_breaker.record_trade_result(is_win)

        if is_win:
            self._consecutive_losses = 0
        else:
            self._consecutive_losses += 1
            self._last_loss_time = time.time()
