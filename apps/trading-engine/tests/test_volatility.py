import numpy as np
import pandas as pd
import pytest

from app.analysis.volatility import fit_garch, volatility_regime


class TestGARCH:
    def test_fit_garch_basic(self, sample_returns):
        result = fit_garch(sample_returns)
        assert "error" not in result
        assert "current_volatility" in result
        assert "forecast_volatility" in result
        assert result["current_volatility"] > 0
        assert result["forecast_volatility"] > 0

    def test_fit_garch_params(self, sample_returns):
        result = fit_garch(sample_returns, p=1, q=1)
        assert result["p"] == 1
        assert result["q"] == 1
        assert "aic" in result
        assert "bic" in result
        assert "params" in result

    def test_fit_garch_insufficient_data(self):
        short = pd.Series([0.01, -0.02, 0.005])
        result = fit_garch(short)
        assert result["error"] == "insufficient_data"
        assert result["min_required"] == 30

    def test_fit_garch_student_t(self, sample_returns):
        result = fit_garch(sample_returns, dist="t")
        assert result["distribution"] == "t"
        assert "error" not in result


class TestVolatilityRegime:
    def test_high_regime(self):
        assert volatility_regime(0.05, 0.02) == "high"

    def test_normal_regime(self):
        assert volatility_regime(0.02, 0.02) == "normal"

    def test_low_regime(self):
        assert volatility_regime(0.01, 0.02) == "low"

    def test_zero_historical(self):
        assert volatility_regime(0.01, 0.0) == "normal"
