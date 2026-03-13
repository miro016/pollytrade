import numpy as np
import pandas as pd
from scipy.stats import entropy as scipy_entropy
from scipy.stats import zscore as scipy_zscore
from statsmodels.tsa.stattools import adfuller


def compute_zscore(prices: pd.Series, window: int = 30) -> pd.Series:
    """Compute rolling z-scores for a price series.

    Z-scores measure how far a price deviates from its rolling mean
    in standard deviations. Values > 2 or < -2 indicate anomalous movements.
    """
    rolling_mean = prices.rolling(window=window).mean()
    rolling_std = prices.rolling(window=window).std()
    return (prices - rolling_mean) / rolling_std.replace(0, np.nan)


def compute_zscore_static(values: np.ndarray) -> np.ndarray:
    """Compute z-scores for an entire array (non-rolling)."""
    return scipy_zscore(values, nan_policy="omit")


def compute_entropy(probability: float) -> float:
    """Compute binary entropy for a prediction market probability.

    Returns entropy in bits (base 2). Max entropy ~1.0 at p=0.5 (max uncertainty).
    Low entropy near 0 or 1 (strong consensus).
    """
    if probability <= 0 or probability >= 1:
        return 0.0
    return float(scipy_entropy([probability, 1 - probability], base=2))


def check_stationarity(prices: pd.Series, significance: float = 0.05) -> dict:
    """Run Augmented Dickey-Fuller test for stationarity.

    If the series is stationary (p < significance), mean-reversion
    strategies are viable.
    """
    clean = prices.dropna()
    if len(clean) < 20:
        return {"stationary": False, "p_value": 1.0, "test_statistic": 0.0, "error": "too_few_observations"}

    result = adfuller(clean, autolag="AIC")
    return {
        "stationary": result[1] < significance,
        "p_value": float(result[1]),
        "test_statistic": float(result[0]),
        "critical_values": {k: float(v) for k, v in result[4].items()},
        "n_lags": int(result[2]),
        "n_observations": int(result[3]),
    }
