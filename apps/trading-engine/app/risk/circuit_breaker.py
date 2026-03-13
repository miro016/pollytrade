import time
from dataclasses import dataclass, field
from enum import Enum

import structlog

logger = structlog.get_logger()


class BreakerState(str, Enum):
    CLOSED = "closed"      # Normal trading
    OPEN = "open"          # All trading halted
    HALF_OPEN = "half_open"  # Testing with reduced size


@dataclass
class CircuitBreaker:
    """Circuit breaker for risk management.

    State transitions:
        CLOSED → OPEN: On drawdown/loss threshold breach
        OPEN → HALF_OPEN: After timeout expires
        HALF_OPEN → CLOSED: After N successful test trades
        HALF_OPEN → OPEN: On any loss during testing
    """

    daily_loss_limit: float = 0.03
    weekly_loss_limit: float = 0.07
    max_consecutive_losses: int = 5
    timeout_seconds: int = 3600
    test_trades_required: int = 3
    half_open_size_multiplier: float = 0.25

    state: BreakerState = BreakerState.CLOSED
    consecutive_losses: int = 0
    test_trade_wins: int = 0
    tripped_at: float = 0.0
    _trip_reason: str = ""

    def check_and_update(
        self,
        daily_pnl_pct: float,
        weekly_pnl_pct: float,
    ) -> BreakerState:
        """Check conditions and update breaker state."""
        if self.state == BreakerState.OPEN:
            # Check if timeout has elapsed
            if time.time() - self.tripped_at >= self.timeout_seconds:
                self._transition(BreakerState.HALF_OPEN, "timeout_elapsed")
            return self.state

        # Check trip conditions (applies to CLOSED and HALF_OPEN)
        if daily_pnl_pct <= -self.daily_loss_limit:
            self._trip(f"daily_loss_{daily_pnl_pct:.2%}")
        elif weekly_pnl_pct <= -self.weekly_loss_limit:
            self._trip(f"weekly_loss_{weekly_pnl_pct:.2%}")
        elif self.consecutive_losses >= self.max_consecutive_losses:
            self._trip(f"consecutive_losses_{self.consecutive_losses}")

        return self.state

    def record_trade_result(self, is_win: bool) -> None:
        """Record a trade result and update state accordingly."""
        if is_win:
            self.consecutive_losses = 0
            if self.state == BreakerState.HALF_OPEN:
                self.test_trade_wins += 1
                if self.test_trade_wins >= self.test_trades_required:
                    self._transition(BreakerState.CLOSED, "test_trades_passed")
        else:
            self.consecutive_losses += 1
            if self.state == BreakerState.HALF_OPEN:
                self._trip("half_open_loss")

    def get_size_multiplier(self) -> float:
        """Get position size multiplier based on current state."""
        if self.state == BreakerState.CLOSED:
            return 1.0
        elif self.state == BreakerState.HALF_OPEN:
            return self.half_open_size_multiplier
        else:
            return 0.0

    def can_trade(self) -> bool:
        """Check if trading is allowed in the current state."""
        return self.state != BreakerState.OPEN

    def _trip(self, reason: str) -> None:
        """Trip the circuit breaker to OPEN state."""
        self._transition(BreakerState.OPEN, reason)
        self.tripped_at = time.time()
        self.test_trade_wins = 0

    def _transition(self, new_state: BreakerState, reason: str) -> None:
        """Transition to a new state."""
        old_state = self.state
        self.state = new_state
        self._trip_reason = reason
        logger.info(
            "circuit_breaker_transition",
            from_state=old_state.value,
            to_state=new_state.value,
            reason=reason,
        )
        if new_state == BreakerState.HALF_OPEN:
            self.test_trade_wins = 0
