import pytest

from app.risk.kelly import kelly_criterion


class TestKellyCriterion:
    def test_positive_edge(self):
        """70% estimated probability at 55¢ should recommend trading."""
        result = kelly_criterion(
            estimated_probability=0.70,
            market_price=0.55,
        )
        assert result.should_trade is True
        assert result.edge > 0
        assert result.fraction > 0
        assert result.half_kelly > 0
        assert result.capped > 0

    def test_no_edge(self):
        """Equal probability and price → no edge → don't trade."""
        result = kelly_criterion(
            estimated_probability=0.55,
            market_price=0.55,
        )
        assert result.fraction == 0.0 or result.should_trade is False

    def test_negative_edge(self):
        """Lower probability than price → negative edge → don't trade."""
        result = kelly_criterion(
            estimated_probability=0.40,
            market_price=0.55,
        )
        assert result.should_trade is False

    def test_half_kelly_is_half(self):
        """Half-Kelly should be 50% of full Kelly."""
        result = kelly_criterion(
            estimated_probability=0.80,
            market_price=0.55,
            kelly_fraction=0.5,
        )
        assert abs(result.half_kelly - result.fraction * 0.5) < 0.001

    def test_max_position_cap(self):
        """Strong edge should still be capped."""
        result = kelly_criterion(
            estimated_probability=0.95,
            market_price=0.55,
            max_position=0.10,
        )
        assert result.capped <= 0.10

    def test_min_edge_threshold(self):
        """Small edge below threshold → don't trade."""
        result = kelly_criterion(
            estimated_probability=0.56,
            market_price=0.55,
            min_edge=0.02,
        )
        # Edge is only 0.01, below min_edge of 0.02
        assert result.should_trade is False

    def test_boundary_price_zero(self):
        result = kelly_criterion(estimated_probability=0.5, market_price=0.0)
        assert result.fraction == 0.0
        assert result.should_trade is False

    def test_boundary_price_one(self):
        result = kelly_criterion(estimated_probability=0.5, market_price=1.0)
        assert result.fraction == 0.0
        assert result.should_trade is False

    def test_boundary_probability_zero(self):
        result = kelly_criterion(estimated_probability=0.0, market_price=0.5)
        assert result.should_trade is False

    def test_custom_kelly_fraction(self):
        """Quarter-Kelly should be 25% of full Kelly."""
        result = kelly_criterion(
            estimated_probability=0.80,
            market_price=0.55,
            kelly_fraction=0.25,
        )
        assert abs(result.half_kelly - result.fraction * 0.25) < 0.001
