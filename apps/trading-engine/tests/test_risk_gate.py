import time
from unittest.mock import patch

import pytest

from app.risk.circuit_breaker import BreakerState
from app.risk.gate import GateResult, RiskManagementGate, TradeProposal


@pytest.fixture
def gate():
    return RiskManagementGate(
        max_daily_drawdown=0.05,
        max_total_drawdown=0.15,
        kelly_fraction=0.5,
        max_position_size=0.10,
        min_edge=0.02,
    )


@pytest.fixture
def good_proposal():
    return TradeProposal(
        market_id="test-market-1",
        direction="buy",
        estimated_probability=0.70,
        market_price=0.55,
        bankroll=10000.0,
    )


class TestRiskGate:
    def test_approve_good_proposal(self, gate, good_proposal):
        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )
        assert result.approved is True
        assert result.position_size > 0
        assert result.kelly is not None

    def test_reject_daily_drawdown(self, gate, good_proposal):
        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=-0.06,
            total_pnl_pct=-0.06,
        )
        assert result.approved is False
        assert "daily_drawdown" in result.rejection_reason

    def test_reject_total_drawdown(self, gate, good_proposal):
        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=-0.16,
            peak_balance=11000.0,
        )
        # With peak_balance=11000 and bankroll=10000, drawdown = 9.09%
        # Need to set up larger drawdown
        proposal = TradeProposal(
            market_id="test",
            direction="buy",
            estimated_probability=0.70,
            market_price=0.55,
            bankroll=8000.0,
        )
        result = gate.evaluate(
            proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=-0.20,
            peak_balance=10000.0,  # 20% drawdown from peak
        )
        assert result.approved is False
        assert "total_drawdown" in result.rejection_reason

    def test_reject_circuit_breaker_open(self, gate, good_proposal):
        gate.circuit_breaker.state = BreakerState.OPEN
        gate.circuit_breaker.tripped_at = time.time()
        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )
        assert result.approved is False
        assert "circuit_breaker" in result.rejection_reason

    def test_reject_insufficient_edge(self, gate):
        # Price and probability very close → no edge
        proposal = TradeProposal(
            market_id="test",
            direction="buy",
            estimated_probability=0.56,
            market_price=0.55,
            bankroll=10000.0,
        )
        result = gate.evaluate(
            proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )
        assert result.approved is False
        assert "insufficient_edge" in result.rejection_reason

    def test_half_open_reduces_size(self, gate, good_proposal):
        # Get full size first
        full_result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )

        # Now set to half-open
        gate.circuit_breaker.state = BreakerState.HALF_OPEN
        half_result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )

        assert half_result.approved is True
        assert half_result.position_size < full_result.position_size

    def test_cooldown_after_losses(self, gate, good_proposal):
        # Record 3 consecutive losses
        gate.record_result(is_win=False)
        gate.record_result(is_win=False)
        gate.record_result(is_win=False)

        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )
        assert result.approved is False
        assert "cooldown" in result.rejection_reason

    def test_win_resets_cooldown(self, gate, good_proposal):
        gate.record_result(is_win=False)
        gate.record_result(is_win=False)
        gate.record_result(is_win=True)  # Reset

        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )
        assert result.approved is True

    def test_position_size_capped(self, gate, good_proposal):
        result = gate.evaluate(
            good_proposal,
            daily_pnl_pct=0.0,
            total_pnl_pct=0.0,
        )
        # Max 10% of bankroll
        assert result.position_size <= good_proposal.bankroll * 0.10
