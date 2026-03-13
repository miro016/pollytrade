from dataclasses import dataclass, field
from enum import Enum

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import TimeSeriesSplit

from app.analysis.statistics import compute_entropy, compute_zscore
from app.analysis.volatility import fit_garch


class Direction(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


@dataclass
class Signal:
    signal_type: str
    direction: Direction
    value: float
    confidence: float
    metadata: dict = field(default_factory=dict)


class SignalGenerator:
    """Generate trading signals from market data using multiple analysis methods."""

    def __init__(self, config: dict | None = None):
        self.config = config or {}
        self.ml_model: GradientBoostingClassifier | None = None

    def generate_zscore_signal(
        self,
        prices: pd.Series,
        window: int = 30,
        threshold: float = 2.0,
    ) -> Signal:
        """Generate signal based on z-score mean reversion."""
        z_scores = compute_zscore(prices, window=window)
        current_z = z_scores.iloc[-1]

        if np.isnan(current_z):
            return Signal("zscore", Direction.HOLD, 0.0, 0.0)

        if current_z < -threshold:
            direction = Direction.BUY  # Price below mean — expect reversion up
            confidence = min(abs(current_z) / (threshold * 2), 1.0)
        elif current_z > threshold:
            direction = Direction.SELL  # Price above mean — expect reversion down
            confidence = min(abs(current_z) / (threshold * 2), 1.0)
        else:
            direction = Direction.HOLD
            confidence = 0.0

        return Signal(
            signal_type="zscore",
            direction=direction,
            value=float(current_z),
            confidence=confidence,
            metadata={"window": window, "threshold": threshold},
        )

    def generate_entropy_signal(
        self,
        current_price: float,
        threshold: float = 0.5,
    ) -> Signal:
        """Generate signal based on market entropy (uncertainty).

        Low entropy means strong consensus — less opportunity.
        High entropy means uncertainty — more opportunity if we have edge.
        """
        ent = compute_entropy(current_price)

        if ent > threshold:
            # High uncertainty — opportunity if we have a view
            if current_price < 0.5:
                direction = Direction.BUY
            else:
                direction = Direction.SELL
            confidence = min(ent, 1.0)
        else:
            direction = Direction.HOLD
            confidence = 0.0

        return Signal(
            signal_type="entropy",
            direction=direction,
            value=ent,
            confidence=confidence,
            metadata={"price": current_price, "threshold": threshold},
        )

    def generate_garch_signal(
        self,
        returns: pd.Series,
        p: int = 1,
        q: int = 1,
    ) -> Signal:
        """Generate signal based on GARCH volatility forecast."""
        result = fit_garch(returns, p=p, q=q)

        if "error" in result:
            return Signal("garch", Direction.HOLD, 0.0, 0.0, metadata=result)

        forecast_vol = result["forecast_volatility"]
        current_vol = result["current_volatility"]

        # Low forecast volatility relative to current → markets stabilizing → hold/trade
        # High forecast volatility → risk increasing → reduce exposure
        if forecast_vol < current_vol * 0.8:
            direction = Direction.BUY  # Volatility contracting — favorable
            confidence = min((current_vol - forecast_vol) / current_vol, 1.0)
        elif forecast_vol > current_vol * 1.5:
            direction = Direction.SELL  # Volatility expanding — reduce risk
            confidence = min((forecast_vol - current_vol) / forecast_vol, 1.0)
        else:
            direction = Direction.HOLD
            confidence = 0.0

        return Signal(
            signal_type="garch",
            direction=direction,
            value=forecast_vol,
            confidence=confidence,
            metadata=result,
        )

    def train_ml_model(
        self,
        features: pd.DataFrame,
        labels: pd.Series,
        n_splits: int = 5,
    ) -> dict:
        """Train a gradient boosting classifier with walk-forward validation."""
        tscv = TimeSeriesSplit(n_splits=n_splits)
        scores = []

        for train_idx, test_idx in tscv.split(features):
            X_train, X_test = features.iloc[train_idx], features.iloc[test_idx]
            y_train, y_test = labels.iloc[train_idx], labels.iloc[test_idx]

            model = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=3,
                learning_rate=0.1,
                random_state=42,
            )
            model.fit(X_train, y_train)
            scores.append(model.score(X_test, y_test))

        # Final model trained on all data
        self.ml_model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.1,
            random_state=42,
        )
        self.ml_model.fit(features, labels)

        return {
            "mean_accuracy": float(np.mean(scores)),
            "std_accuracy": float(np.std(scores)),
            "fold_scores": [float(s) for s in scores],
            "n_splits": n_splits,
        }

    def generate_ml_signal(self, features: pd.DataFrame) -> Signal:
        """Generate signal from the trained ML model."""
        if self.ml_model is None:
            return Signal("ml", Direction.HOLD, 0.0, 0.0, metadata={"error": "model_not_trained"})

        latest = features.iloc[[-1]]
        prediction = self.ml_model.predict(latest)[0]
        probabilities = self.ml_model.predict_proba(latest)[0]
        confidence = float(max(probabilities))

        direction = Direction.BUY if prediction == 1 else Direction.SELL

        return Signal(
            signal_type="ml",
            direction=direction,
            value=float(prediction),
            confidence=confidence,
            metadata={"probabilities": probabilities.tolist()},
        )

    def generate_composite_signal(self, signals: list[Signal], weights: dict[str, float]) -> Signal:
        """Combine multiple signals into a weighted composite signal."""
        if not signals:
            return Signal("composite", Direction.HOLD, 0.0, 0.0)

        buy_score = 0.0
        sell_score = 0.0
        total_weight = 0.0

        for sig in signals:
            if sig.direction == Direction.HOLD or sig.confidence == 0:
                continue
            weight = weights.get(sig.signal_type, 1.0)
            if sig.direction == Direction.BUY:
                buy_score += sig.confidence * weight
            else:
                sell_score += sig.confidence * weight
            total_weight += weight

        if total_weight == 0:
            return Signal("composite", Direction.HOLD, 0.0, 0.0)

        buy_score /= total_weight
        sell_score /= total_weight

        if buy_score > sell_score and buy_score > 0.3:
            return Signal("composite", Direction.BUY, buy_score, buy_score)
        elif sell_score > buy_score and sell_score > 0.3:
            return Signal("composite", Direction.SELL, sell_score, sell_score)
        else:
            return Signal("composite", Direction.HOLD, 0.0, 0.0)
