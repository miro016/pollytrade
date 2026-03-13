import numpy as np
import pandas as pd
from arch import arch_model


def fit_garch(
    returns: pd.Series,
    p: int = 1,
    q: int = 1,
    dist: str = "t",
) -> dict:
    """Fit a GARCH(p,q) model and return volatility forecast.

    Uses Student's t distribution by default for heavier tails
    common in financial returns.

    Returns:
        Dictionary with current volatility, forecast, and model parameters.
    """
    clean_returns = returns.dropna()
    if len(clean_returns) < 30:
        return {"error": "insufficient_data", "min_required": 30, "got": len(clean_returns)}

    # Scale returns to percentage for numerical stability
    scaled = clean_returns * 100

    am = arch_model(scaled, vol="Garch", p=p, q=q, dist=dist)
    res = am.fit(disp="off", show_warning=False)

    # One-step-ahead variance forecast
    forecast = res.forecast(horizon=1)
    forecast_variance = forecast.variance.iloc[-1].values[0]
    forecast_vol = float(np.sqrt(forecast_variance)) / 100  # Scale back

    return {
        "current_volatility": float(res.conditional_volatility.iloc[-1]) / 100,
        "forecast_volatility": forecast_vol,
        "aic": float(res.aic),
        "bic": float(res.bic),
        "params": {k: float(v) for k, v in res.params.items()},
        "p": p,
        "q": q,
        "distribution": dist,
    }


def volatility_regime(forecast_vol: float, historical_vol: float) -> str:
    """Classify the current volatility regime.

    Used for dynamic position sizing: smaller positions in high-vol regimes.
    """
    ratio = forecast_vol / historical_vol if historical_vol > 0 else 1.0

    if ratio > 1.5:
        return "high"
    elif ratio > 0.8:
        return "normal"
    else:
        return "low"
