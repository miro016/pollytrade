import numpy as np
import pandas as pd
import talib


def compute_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Compute Relative Strength Index."""
    result = talib.RSI(prices.values.astype(float), timeperiod=period)
    return pd.Series(result, index=prices.index, name="rsi")


def compute_macd(
    prices: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    """Compute MACD (Moving Average Convergence Divergence).

    Returns DataFrame with MACD line, signal line, and histogram.
    """
    macd, signal_line, histogram = talib.MACD(
        prices.values.astype(float),
        fastperiod=fast,
        slowperiod=slow,
        signalperiod=signal,
    )
    return pd.DataFrame(
        {"macd": macd, "signal": signal_line, "histogram": histogram},
        index=prices.index,
    )


def compute_bollinger_bands(
    prices: pd.Series,
    period: int = 20,
    std_dev: float = 2.0,
) -> pd.DataFrame:
    """Compute Bollinger Bands."""
    upper, mid, lower = talib.BBANDS(
        prices.values.astype(float),
        timeperiod=period,
        nbdevup=std_dev,
        nbdevdn=std_dev,
    )
    return pd.DataFrame(
        {"lower": lower, "mid": mid, "upper": upper},
        index=prices.index,
    )


def compute_sma(prices: pd.Series, period: int = 20) -> pd.Series:
    """Compute Simple Moving Average."""
    result = talib.SMA(prices.values.astype(float), timeperiod=period)
    return pd.Series(result, index=prices.index, name=f"sma_{period}")


def compute_ema(prices: pd.Series, period: int = 12) -> pd.Series:
    """Compute Exponential Moving Average."""
    result = talib.EMA(prices.values.astype(float), timeperiod=period)
    return pd.Series(result, index=prices.index, name=f"ema_{period}")


def compute_all_indicators(prices: pd.Series) -> dict[str, pd.Series | pd.DataFrame]:
    """Compute a standard set of technical indicators for a price series."""
    return {
        "rsi": compute_rsi(prices),
        "macd": compute_macd(prices),
        "bbands": compute_bollinger_bands(prices),
        "sma_20": compute_sma(prices, period=20),
        "ema_12": compute_ema(prices, period=12),
    }
