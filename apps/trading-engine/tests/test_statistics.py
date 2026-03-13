import numpy as np
import pandas as pd
import pytest

from app.analysis.statistics import (
    compute_entropy,
    compute_zscore,
    compute_zscore_static,
    check_stationarity,
)


class TestZScore:
    def test_zscore_returns_series(self, sample_prices):
        result = compute_zscore(sample_prices, window=20)
        assert isinstance(result, pd.Series)
        assert len(result) == len(sample_prices)

    def test_zscore_nan_for_initial_window(self, sample_prices):
        result = compute_zscore(sample_prices, window=20)
        # First 19 values should be NaN (window-1)
        assert result.iloc[:19].isna().all()

    def test_zscore_centered_on_stationary_data(self):
        """Z-scores of stationary data should be roughly centered near zero."""
        np.random.seed(123)
        stationary = pd.Series(np.random.normal(50, 5, 500))
        result = compute_zscore(stationary, window=30)
        valid = result.dropna()
        assert abs(valid.mean()) < 0.5

    def test_zscore_static(self):
        values = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        result = compute_zscore_static(values)
        assert len(result) == 5
        assert abs(result[2]) < 0.01  # Middle value should be ~0
        assert result[0] < 0  # Lowest should be negative
        assert result[4] > 0  # Highest should be positive


class TestEntropy:
    def test_max_entropy_at_half(self):
        ent = compute_entropy(0.5)
        assert abs(ent - 1.0) < 0.01  # Max entropy = 1 bit

    def test_low_entropy_at_extreme(self):
        ent = compute_entropy(0.95)
        assert ent < 0.4  # Low uncertainty

    def test_zero_entropy_at_boundary(self):
        assert compute_entropy(0.0) == 0.0
        assert compute_entropy(1.0) == 0.0

    def test_symmetric(self):
        assert abs(compute_entropy(0.3) - compute_entropy(0.7)) < 0.01

    def test_entropy_range(self):
        for p in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
            ent = compute_entropy(p)
            assert 0.0 <= ent <= 1.0


class TestStationarity:
    def test_stationary_series(self):
        np.random.seed(42)
        stationary = pd.Series(np.random.normal(0, 1, 200))
        result = check_stationarity(stationary)
        assert result["stationary"] == True
        assert result["p_value"] < 0.05

    def test_nonstationary_series(self):
        np.random.seed(42)
        random_walk = pd.Series(np.cumsum(np.random.normal(0, 1, 200)))
        result = check_stationarity(random_walk)
        # Random walk should typically not be stationary
        assert "p_value" in result

    def test_too_few_observations(self):
        short = pd.Series([1.0, 2.0, 3.0])
        result = check_stationarity(short)
        assert result["stationary"] is False
        assert result["error"] == "too_few_observations"

    def test_result_structure(self, sample_prices):
        result = check_stationarity(sample_prices)
        assert "stationary" in result
        assert "p_value" in result
        assert "test_statistic" in result
