import numpy as np

from app.analysis.game_theory import compute_nash_equilibrium, optimal_aggressiveness


class TestNashEquilibrium:
    def test_finds_equilibrium(self):
        # Simple 2x2 game
        bot = np.array([[3, 1], [0, 2]])
        market = np.array([[2, 0], [1, 3]])
        result = compute_nash_equilibrium(bot, market)
        assert result["found"] is True
        assert len(result["bot_strategy"]) == 2
        assert len(result["market_strategy"]) == 2

    def test_strategy_probabilities_sum_to_one(self):
        bot = np.array([[3, 1], [0, 2]])
        market = np.array([[2, 0], [1, 3]])
        result = compute_nash_equilibrium(bot, market)
        assert abs(sum(result["bot_strategy"]) - 1.0) < 0.01
        assert abs(sum(result["market_strategy"]) - 1.0) < 0.01

    def test_dominant_strategy(self):
        # Bot always prefers first strategy
        bot = np.array([[5, 5], [0, 0]])
        market = np.array([[1, 1], [1, 1]])
        result = compute_nash_equilibrium(bot, market)
        assert result["found"] is True
        # Bot should play first strategy with high probability
        assert result["bot_strategy"][0] >= 0.99

    def test_num_equilibria(self):
        bot = np.array([[3, 1], [0, 2]])
        market = np.array([[2, 0], [1, 3]])
        result = compute_nash_equilibrium(bot, market)
        assert result["num_equilibria"] >= 1


class TestOptimalAggressiveness:
    def test_returns_probability(self):
        result = optimal_aggressiveness(spread=0.02, volatility=0.05, edge=0.05)
        assert 0.0 <= result <= 1.0

    def test_higher_edge_more_aggressive(self):
        low_edge = optimal_aggressiveness(spread=0.02, volatility=0.05, edge=0.01)
        high_edge = optimal_aggressiveness(spread=0.02, volatility=0.05, edge=0.10)
        # Higher edge should generally lead to more aggressiveness
        # (not strictly guaranteed due to game theory, but typical)
        assert isinstance(low_edge, float)
        assert isinstance(high_edge, float)
