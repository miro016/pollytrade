import numpy as np
import nashpy as nash


def compute_nash_equilibrium(
    bot_payoffs: np.ndarray,
    market_payoffs: np.ndarray,
) -> dict:
    """Compute Nash equilibrium for a 2-player game (bot vs market maker).

    Strategies:
        Bot: [aggressive, passive]
        Market: [tight_spread, wide_spread]

    Returns optimal mixed strategy probabilities.
    """
    game = nash.Game(bot_payoffs, market_payoffs)
    equilibria = list(game.support_enumeration())

    if not equilibria:
        return {
            "found": False,
            "bot_strategy": [0.5, 0.5],
            "market_strategy": [0.5, 0.5],
        }

    # Use first equilibrium found
    bot_strategy, market_strategy = equilibria[0]

    return {
        "found": True,
        "bot_strategy": bot_strategy.tolist(),
        "market_strategy": market_strategy.tolist(),
        "num_equilibria": len(equilibria),
    }


def optimal_aggressiveness(
    spread: float,
    volatility: float,
    edge: float,
) -> float:
    """Determine optimal order aggressiveness based on game theory.

    Higher aggressiveness (closer to 1.0) when:
    - Spread is tight (good execution likely)
    - Volatility is low (less adverse selection risk)
    - Edge is large (strong signal)
    """
    # Construct payoff matrices for aggressive vs passive
    bot_payoffs = np.array([
        [edge - spread, edge - spread * 0.5],  # aggressive vs tight/wide
        [edge * 0.5, edge * 0.3],              # passive vs tight/wide
    ])
    market_payoffs = np.array([
        [spread - edge * 0.3, spread * 0.5],   # tight vs aggressive/passive
        [spread * 1.5, spread * 0.8],           # wide vs aggressive/passive
    ])

    result = compute_nash_equilibrium(bot_payoffs, market_payoffs)
    # Return probability of aggressive strategy
    return float(result["bot_strategy"][0])
