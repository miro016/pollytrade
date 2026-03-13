from dataclasses import dataclass


@dataclass
class KellyResult:
    fraction: float  # Raw Kelly fraction
    half_kelly: float  # Half-Kelly (recommended)
    capped: float  # After max position cap
    edge: float  # Estimated edge
    should_trade: bool  # Whether edge exceeds minimum threshold


def kelly_criterion(
    estimated_probability: float,
    market_price: float,
    *,
    kelly_fraction: float = 0.5,
    max_position: float = 0.10,
    min_edge: float = 0.02,
) -> KellyResult:
    """Calculate Kelly criterion for binary prediction market outcomes.

    Formula: f* = (b*p - q) / b
    Where:
        b = net odds = (1 - price) / price
        p = estimated true probability
        q = 1 - p

    Args:
        estimated_probability: Model's estimated true probability (0-1).
        market_price: Current market price for YES token (0-1).
        kelly_fraction: Fraction of full Kelly to use (0.5 = half-Kelly).
        max_position: Maximum position as fraction of bankroll.
        min_edge: Minimum edge required to trade.
    """
    if market_price <= 0 or market_price >= 1:
        return KellyResult(0.0, 0.0, 0.0, 0.0, False)

    if estimated_probability <= 0 or estimated_probability >= 1:
        return KellyResult(0.0, 0.0, 0.0, 0.0, False)

    # Net odds for a YES token at this price
    b = (1 - market_price) / market_price
    p = estimated_probability
    q = 1 - p

    # Edge: expected value per dollar risked
    edge = p - market_price

    # Full Kelly fraction
    full_kelly = (b * p - q) / b

    if full_kelly <= 0:
        return KellyResult(0.0, 0.0, 0.0, float(edge), False)

    # Apply fractional Kelly
    fractional = full_kelly * kelly_fraction

    # Apply position cap
    capped = min(fractional, max_position)

    # Check minimum edge
    should_trade = abs(edge) >= min_edge and full_kelly > 0

    return KellyResult(
        fraction=float(full_kelly),
        half_kelly=float(fractional),
        capped=float(capped),
        edge=float(edge),
        should_trade=should_trade,
    )
