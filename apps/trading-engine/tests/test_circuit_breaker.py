import time
from unittest.mock import patch

import pytest

from app.risk.circuit_breaker import BreakerState, CircuitBreaker


class TestCircuitBreaker:
    def test_initial_state_closed(self):
        cb = CircuitBreaker()
        assert cb.state == BreakerState.CLOSED
        assert cb.can_trade() is True
        assert cb.get_size_multiplier() == 1.0

    def test_trips_on_daily_loss(self):
        cb = CircuitBreaker(daily_loss_limit=0.03)
        cb.check_and_update(daily_pnl_pct=-0.04, weekly_pnl_pct=0.0)
        assert cb.state == BreakerState.OPEN
        assert cb.can_trade() is False
        assert cb.get_size_multiplier() == 0.0

    def test_trips_on_weekly_loss(self):
        cb = CircuitBreaker(weekly_loss_limit=0.07)
        cb.check_and_update(daily_pnl_pct=-0.01, weekly_pnl_pct=-0.08)
        assert cb.state == BreakerState.OPEN

    def test_trips_on_consecutive_losses(self):
        cb = CircuitBreaker(max_consecutive_losses=3)
        for _ in range(3):
            cb.record_trade_result(is_win=False)
        cb.check_and_update(daily_pnl_pct=0.0, weekly_pnl_pct=0.0)
        assert cb.state == BreakerState.OPEN

    def test_open_to_half_open_on_timeout(self):
        cb = CircuitBreaker(timeout_seconds=1)
        cb.check_and_update(daily_pnl_pct=-0.05, weekly_pnl_pct=0.0)
        assert cb.state == BreakerState.OPEN

        # Simulate timeout
        cb.tripped_at = time.time() - 2
        cb.check_and_update(daily_pnl_pct=0.0, weekly_pnl_pct=0.0)
        assert cb.state == BreakerState.HALF_OPEN

    def test_half_open_size_multiplier(self):
        cb = CircuitBreaker(half_open_size_multiplier=0.25)
        cb.state = BreakerState.HALF_OPEN
        assert cb.get_size_multiplier() == 0.25
        assert cb.can_trade() is True

    def test_half_open_to_closed_on_wins(self):
        cb = CircuitBreaker(test_trades_required=3)
        cb.state = BreakerState.HALF_OPEN
        cb.test_trade_wins = 0

        cb.record_trade_result(is_win=True)
        assert cb.state == BreakerState.HALF_OPEN
        cb.record_trade_result(is_win=True)
        assert cb.state == BreakerState.HALF_OPEN
        cb.record_trade_result(is_win=True)
        assert cb.state == BreakerState.CLOSED

    def test_half_open_to_open_on_loss(self):
        cb = CircuitBreaker()
        cb.state = BreakerState.HALF_OPEN
        cb.record_trade_result(is_win=False)
        assert cb.state == BreakerState.OPEN

    def test_win_resets_consecutive_losses(self):
        cb = CircuitBreaker()
        cb.record_trade_result(is_win=False)
        cb.record_trade_result(is_win=False)
        assert cb.consecutive_losses == 2
        cb.record_trade_result(is_win=True)
        assert cb.consecutive_losses == 0

    def test_no_trip_within_limits(self):
        cb = CircuitBreaker(daily_loss_limit=0.03, weekly_loss_limit=0.07)
        cb.check_and_update(daily_pnl_pct=-0.01, weekly_pnl_pct=-0.02)
        assert cb.state == BreakerState.CLOSED
