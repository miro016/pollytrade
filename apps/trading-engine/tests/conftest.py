import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def sample_prices() -> pd.Series:
    """Generate a synthetic price series for testing."""
    np.random.seed(42)
    n = 100
    # Random walk around 0.55
    returns = np.random.normal(0, 0.02, n)
    prices = 0.55 + np.cumsum(returns)
    # Clip to valid prediction market range
    prices = np.clip(prices, 0.01, 0.99)
    return pd.Series(prices, name="price")


@pytest.fixture
def sample_returns() -> pd.Series:
    """Generate a synthetic return series for testing."""
    np.random.seed(42)
    n = 200
    returns = np.random.normal(0.0001, 0.01, n)
    return pd.Series(returns, name="returns")


@pytest.fixture
def sample_features() -> pd.DataFrame:
    """Generate synthetic features for ML testing."""
    np.random.seed(42)
    n = 200
    return pd.DataFrame({
        "rsi": np.random.uniform(20, 80, n),
        "zscore": np.random.normal(0, 1, n),
        "volatility": np.random.uniform(0.01, 0.1, n),
        "volume": np.random.uniform(1000, 100000, n),
    })


@pytest.fixture
def sample_labels() -> pd.Series:
    """Generate synthetic labels (1=up, 0=down) for ML testing."""
    np.random.seed(42)
    return pd.Series(np.random.randint(0, 2, 200))
