/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const strategyConfigs = app.findCollectionByNameOrId("strategy_configs");

    const strategies = [
        // ==========================================
        // CONSERVATIVE STRATEGIES (20) - Low risk, strict limits
        // ==========================================
        {
            name: "Conservative - Mean Reversion Focus",
            description: "Primarily uses Z-Score mean reversion with high threshold, filtering for strong reversion signals only",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 40, threshold: 2.5, weight: 0.5 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.1 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Volatility Filter",
            description: "Emphasizes GARCH volatility forecasting to only trade in low-volatility environments",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.3, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.5 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.1 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Entropy Guard",
            description: "High entropy threshold filters out uncertain markets, only trades when market consensus is clear",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 35, threshold: 2.0, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.3, weight: 0.4 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.15 },
                },
                min_confidence: 0.75,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - RSI Confirmation",
            description: "Requires RSI extremes to confirm entry signals, reducing false positives",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 14, overbought: 80, oversold: 20, weight: 0.4 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Long Window Reversion",
            description: "Uses extended lookback periods for Z-Score to capture only significant deviations",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 60, threshold: 2.5, weight: 0.4 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 21, overbought: 75, oversold: 25, weight: 0.15 },
                },
                min_confidence: 0.7,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Equal Weight Consensus",
            description: "All four indicators weighted equally, requiring broad consensus for trades",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.25 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.25 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Slow Momentum",
            description: "Uses longer RSI period with strict overbought/oversold levels for slow momentum plays",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 28, overbought: 80, oversold: 20, weight: 0.4 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Minimum Volatility",
            description: "Focuses on GARCH(2,1) for more stable volatility estimation with high confidence requirement",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.5, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.35, weight: 0.2 },
                    garch: { enabled: true, p: 2, q: 1, weight: 0.45 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.15 },
                },
                min_confidence: 0.75,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - High Edge Only",
            description: "Requires very high minimum edge before taking any position, ultra-selective",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.3 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.8,
                min_edge: 0.06,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Dual Mean Reversion",
            description: "Combines Z-Score and RSI for double mean-reversion confirmation with tight thresholds",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 45, threshold: 2.5, weight: 0.35 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 14, overbought: 80, oversold: 20, weight: 0.4 },
                },
                min_confidence: 0.75,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Stability Seeker",
            description: "Prioritizes low entropy and stable volatility, avoids uncertain and volatile markets",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.25, weight: 0.4 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.35 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.1 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Wide Band Reversion",
            description: "Very wide Z-Score threshold captures only extreme deviations for high-probability trades",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 50, threshold: 3.0, weight: 0.5 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.15 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Triple Filter",
            description: "Three-indicator confirmation: Z-Score direction, GARCH low-vol, entropy consensus",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 35, threshold: 2.0, weight: 0.35 },
                    entropy: { enabled: true, threshold: 0.35, weight: 0.3 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.3 },
                    rsi: { enabled: false, period: 14, overbought: 70, oversold: 30, weight: 0.05 },
                },
                min_confidence: 0.75,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Weekend Warrior",
            description: "Extended lookback with high confidence gates designed for markets with weekly resolution cycles",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 50, threshold: 2.0, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.25 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 21, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Volatility Compression",
            description: "GARCH(1,2) model targeting volatility compression breakout setups with caution",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.4, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 2, weight: 0.5 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.15 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Pure Z-Score",
            description: "Single-indicator strategy relying exclusively on strong Z-Score signals with strict gates",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 40, threshold: 2.5, weight: 0.8 },
                    entropy: { enabled: false, threshold: 0.5, weight: 0.1 },
                    garch: { enabled: false, p: 1, q: 1, weight: 0.05 },
                    rsi: { enabled: false, period: 14, overbought: 70, oversold: 30, weight: 0.05 },
                },
                min_confidence: 0.75,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Defensive Combo",
            description: "Balances entropy and GARCH for defensive positioning, avoids chaotic markets",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.3, weight: 0.35 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.35 },
                    rsi: { enabled: true, period: 14, overbought: 75, oversold: 25, weight: 0.15 },
                },
                min_confidence: 0.7,
                min_edge: 0.04,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Deep Value",
            description: "Extreme mean reversion strategy that only trades deep value opportunities with max edge",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 60, threshold: 3.0, weight: 0.45 },
                    entropy: { enabled: true, threshold: 0.35, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 21, overbought: 80, oversold: 20, weight: 0.15 },
                },
                min_confidence: 0.8,
                min_edge: 0.06,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Calm Waters",
            description: "Very low entropy threshold means trades only in highly predictable markets",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.2, weight: 0.4 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.1 },
                },
                min_confidence: 0.75,
                min_edge: 0.05,
            },
            category: "conservative",
        },
        {
            name: "Conservative - Sentinel",
            description: "Maximum confidence and edge requirements with balanced indicators for capital preservation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 40, threshold: 2.5, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.35, weight: 0.25 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 14, overbought: 80, oversold: 20, weight: 0.25 },
                },
                min_confidence: 0.8,
                min_edge: 0.06,
            },
            category: "conservative",
        },

        // ==========================================
        // REALISTIC STRATEGIES (20) - Balanced risk/reward
        // ==========================================
        {
            name: "Realistic - Balanced Core",
            description: "Well-balanced strategy using all four indicators with moderate thresholds",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.25 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Momentum Blend",
            description: "Blends RSI momentum with Z-Score reversion for trend-following with mean reversion exits",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 20, threshold: 1.5, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 65, oversold: 35, weight: 0.4 },
                },
                min_confidence: 0.55,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Volatility Adaptive",
            description: "Higher GARCH weight adapts position sizing based on current volatility regime",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.2 },
                    garch: { enabled: true, p: 2, q: 1, weight: 0.4 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Quick Reversion",
            description: "Shorter Z-Score window captures faster mean reversion opportunities in active markets",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.5, weight: 0.45 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 10, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.5,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Entropy Explorer",
            description: "Uses moderate entropy thresholds to find markets with tradeable uncertainty levels",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.55, weight: 0.35 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Dual Timeframe",
            description: "Medium-window Z-Score with short RSI period for multi-timeframe signal generation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 1.8, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 7, overbought: 70, oversold: 30, weight: 0.35 },
                },
                min_confidence: 0.55,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Trend Rider",
            description: "RSI-heavy strategy for riding established trends with volatility confirmation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 20, threshold: 1.5, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 14, overbought: 65, oversold: 35, weight: 0.45 },
                },
                min_confidence: 0.5,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Statistical Edge",
            description: "Z-Score dominant strategy optimized for statistical edge with moderate confidence",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.5, weight: 0.5 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.15 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Market Regime",
            description: "GARCH(2,2) model identifies market regimes for adaptive strategy behavior",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.2 },
                    garch: { enabled: true, p: 2, q: 2, weight: 0.4 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Contrarian Light",
            description: "Moderate contrarian approach using Z-Score with entropy validation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 20, threshold: 1.8, weight: 0.4 },
                    entropy: { enabled: true, threshold: 0.55, weight: 0.25 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Active Trader",
            description: "Lower thresholds generate more signals for active portfolio management",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 20, threshold: 1.5, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.55, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.3 },
                },
                min_confidence: 0.5,
                min_edge: 0.02,
            },
            category: "realistic",
        },
        {
            name: "Realistic - GARCH Momentum",
            description: "Combines GARCH volatility expansion signals with RSI momentum confirmation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.35 },
                    rsi: { enabled: true, period: 14, overbought: 65, oversold: 35, weight: 0.35 },
                },
                min_confidence: 0.55,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Balanced Three",
            description: "Three-indicator approach without RSI, balancing statistical and volatility signals",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.35 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.3 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.35 },
                    rsi: { enabled: false, period: 14, overbought: 70, oversold: 30, weight: 0.0 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Mid-Cap Focus",
            description: "Moderate parameters tuned for medium-volume markets with decent liquidity",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.3 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Signal Diversifier",
            description: "Equally weighted indicators maximize signal diversity and reduce single-indicator risk",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.25 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.25 },
                },
                min_confidence: 0.5,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Entropy Trader",
            description: "Entropy-focused strategy that exploits information asymmetry in prediction markets",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.45 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Swing Trader",
            description: "Medium-term swing trading with Z-Score and longer RSI period for smoother signals",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 30, threshold: 1.8, weight: 0.35 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 21, overbought: 70, oversold: 30, weight: 0.35 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Vol-Adjusted Edge",
            description: "Uses GARCH output to adjust edge requirements dynamically based on volatility",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.8, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.15 },
                    garch: { enabled: true, p: 1, q: 2, weight: 0.4 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.025,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Probability Weighted",
            description: "Calibrated for prediction market probability estimation with multi-signal fusion",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 25, threshold: 1.5, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.3 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
                },
                min_confidence: 0.55,
                min_edge: 0.03,
            },
            category: "realistic",
        },
        {
            name: "Realistic - Adaptive RSI",
            description: "Shorter RSI with moderate bands adapts quickly to changing market conditions",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 20, threshold: 1.8, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.5, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 7, overbought: 65, oversold: 35, weight: 0.4 },
                },
                min_confidence: 0.5,
                min_edge: 0.025,
            },
            category: "realistic",
        },

        // ==========================================
        // DYNAMIC STRATEGIES (20) - Aggressive, higher risk tolerance
        // ==========================================
        {
            name: "Dynamic - Aggressive Momentum",
            description: "High-frequency RSI momentum strategy with tight bands for rapid signal generation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 7, overbought: 60, oversold: 40, weight: 0.55 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Rapid Reversion",
            description: "Short-window Z-Score with low threshold catches small but frequent mean reversion moves",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.55 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 7, overbought: 65, oversold: 35, weight: 0.15 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Volatility Breakout",
            description: "GARCH-dominant strategy that trades volatility expansion breakouts aggressively",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.65, weight: 0.1 },
                    garch: { enabled: true, p: 2, q: 2, weight: 0.55 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.2 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - All Signals",
            description: "Low thresholds across all indicators maximize trade frequency and market exposure",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.25 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.25 },
                    rsi: { enabled: true, period: 10, overbought: 60, oversold: 40, weight: 0.25 },
                },
                min_confidence: 0.35,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Entropy Maximizer",
            description: "High entropy tolerance actively seeks uncertain markets for contrarian opportunities",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.7, weight: 0.45 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.2 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Scalper",
            description: "Ultra-short windows and minimal thresholds for high-frequency scalping opportunities",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 5, threshold: 0.8, weight: 0.4 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 5, overbought: 60, oversold: 40, weight: 0.3 },
                },
                min_confidence: 0.35,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Trend Chaser",
            description: "Short RSI with narrow bands aggressively follows emerging trends",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.1 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 5, overbought: 55, oversold: 45, weight: 0.6 },
                },
                min_confidence: 0.35,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Contrarian",
            description: "Strong contrarian strategy buying on panic sells and selling on euphoria spikes",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.5 },
                    entropy: { enabled: true, threshold: 0.65, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 7, overbought: 65, oversold: 35, weight: 0.15 },
                },
                min_confidence: 0.4,
                min_edge: 0.02,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Multi-GARCH",
            description: "Advanced GARCH(3,2) model captures complex volatility dynamics for aggressive trading",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.15 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 3, q: 2, weight: 0.55 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.2 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Rapid Fire",
            description: "Minimum confidence and edge requirements for maximum trade frequency",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.65, weight: 0.2 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 7, overbought: 60, oversold: 40, weight: 0.3 },
                },
                min_confidence: 0.3,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Volatility Surfer",
            description: "Rides volatility waves using GARCH with RSI for timing entry and exit",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.1 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 2, q: 1, weight: 0.4 },
                    rsi: { enabled: true, period: 7, overbought: 60, oversold: 40, weight: 0.4 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Pure Momentum",
            description: "Single-indicator RSI momentum strategy for aggressive directional bets",
            parameters: {
                indicators: {
                    zscore: { enabled: false, window: 20, threshold: 1.5, weight: 0.0 },
                    entropy: { enabled: false, threshold: 0.5, weight: 0.0 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 5, overbought: 55, oversold: 45, weight: 0.85 },
                },
                min_confidence: 0.35,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Chaos Trader",
            description: "Thrives in high-entropy environments where most strategies fail, contrarian chaos play",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.2 },
                    entropy: { enabled: true, threshold: 0.75, weight: 0.4 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.2 },
                    rsi: { enabled: true, period: 7, overbought: 65, oversold: 35, weight: 0.2 },
                },
                min_confidence: 0.35,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Breakout Hunter",
            description: "Combines short Z-Score with GARCH to catch price breakouts from compression zones",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 1.0, weight: 0.35 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 1, q: 2, weight: 0.4 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.15 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Dual Momentum",
            description: "Two momentum indicators (RSI short + RSI-like Z-Score) for aggressive trend following",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 7, threshold: 1.0, weight: 0.4 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.05 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.1 },
                    rsi: { enabled: true, period: 5, overbought: 60, oversold: 40, weight: 0.45 },
                },
                min_confidence: 0.35,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Event Driven",
            description: "Designed for prediction markets near resolution, captures last-minute price swings",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 5, threshold: 0.8, weight: 0.3 },
                    entropy: { enabled: true, threshold: 0.7, weight: 0.3 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 5, overbought: 60, oversold: 40, weight: 0.25 },
                },
                min_confidence: 0.35,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Full Throttle",
            description: "Maximum aggression with lowest possible thresholds, for experienced traders only",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 5, threshold: 0.7, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.7, weight: 0.25 },
                    garch: { enabled: true, p: 2, q: 2, weight: 0.25 },
                    rsi: { enabled: true, period: 3, overbought: 55, oversold: 45, weight: 0.25 },
                },
                min_confidence: 0.3,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Smart Beta",
            description: "Factor-tilted approach using GARCH and Z-Score for risk-adjusted aggressive returns",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.35 },
                    entropy: { enabled: true, threshold: 0.6, weight: 0.1 },
                    garch: { enabled: true, p: 2, q: 1, weight: 0.35 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.2 },
                },
                min_confidence: 0.4,
                min_edge: 0.02,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Alpha Seeker",
            description: "Low edge requirement with entropy-driven signal selection for alpha generation",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 15, threshold: 1.2, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.65, weight: 0.35 },
                    garch: { enabled: true, p: 1, q: 1, weight: 0.15 },
                    rsi: { enabled: true, period: 10, overbought: 65, oversold: 35, weight: 0.25 },
                },
                min_confidence: 0.4,
                min_edge: 0.015,
            },
            category: "dynamic",
        },
        {
            name: "Dynamic - Max Exposure",
            description: "Broadest possible signal generation with all indicators at aggressive settings",
            parameters: {
                indicators: {
                    zscore: { enabled: true, window: 10, threshold: 0.8, weight: 0.25 },
                    entropy: { enabled: true, threshold: 0.7, weight: 0.25 },
                    garch: { enabled: true, p: 2, q: 2, weight: 0.25 },
                    rsi: { enabled: true, period: 5, overbought: 55, oversold: 45, weight: 0.25 },
                },
                min_confidence: 0.3,
                min_edge: 0.01,
            },
            category: "dynamic",
        },
    ];

    // Insert all strategies
    for (const s of strategies) {
        const record = new Record(strategyConfigs);
        record.set("name", s.name);
        record.set("description", s.description);
        record.set("parameters", s.parameters);
        record.set("active", false);
        record.set("mode", "paper");
        record.set("version", 1);
        app.save(record);
    }

    console.log(`Seeded ${strategies.length} strategy presets`);

}, (app) => {
    // Revert: delete all seeded strategy presets
    const strategyConfigs = app.findCollectionByNameOrId("strategy_configs");
    const prefixes = ["Conservative -", "Realistic -", "Dynamic -"];
    for (const prefix of prefixes) {
        try {
            const records = app.findRecordsByFilter(
                strategyConfigs.id,
                `name ~ "${prefix}"`,
                "",
                100,
                0
            );
            for (const record of records) {
                app.delete(record);
            }
        } catch (e) {}
    }
});
