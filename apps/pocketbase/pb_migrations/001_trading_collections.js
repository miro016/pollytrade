/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const users = app.findCollectionByNameOrId("users");

    // ========== markets ==========
    let markets = new Collection({
        type: "base",
        name: "markets",
        fields: [
            { type: "text", name: "polymarket_id", required: true, min: 1, max: 200 },
            { type: "text", name: "question", required: true, min: 1, max: 1000 },
            { type: "json", name: "current_prices" },
            { type: "number", name: "volume", min: 0 },
            { type: "number", name: "liquidity", min: 0 },
            { type: "select", name: "status", required: true, values: ["active", "closed", "resolved"], maxSelect: 1 },
            { type: "date", name: "end_date" },
        ],
    });
    app.save(markets);

    // ========== signals ==========
    markets = app.findCollectionByNameOrId("markets");

    let signals = new Collection({
        type: "base",
        name: "signals",
        fields: [
            { type: "relation", name: "market_id", required: true, collectionId: markets.id, cascadeDelete: true, maxSelect: 1 },
            { type: "select", name: "signal_type", required: true, values: ["zscore", "entropy", "garch", "nash", "ml", "technical", "composite"], maxSelect: 1 },
            { type: "select", name: "direction", required: true, values: ["buy", "sell", "hold"], maxSelect: 1 },
            { type: "number", name: "value", required: true },
            { type: "number", name: "confidence", required: true, min: 0, max: 1 },
            { type: "json", name: "metadata" },
        ],
    });
    app.save(signals);

    // ========== trades ==========
    signals = app.findCollectionByNameOrId("signals");

    let trades = new Collection({
        type: "base",
        name: "trades",
        fields: [
            { type: "relation", name: "market_id", required: true, collectionId: markets.id, cascadeDelete: false, maxSelect: 1 },
            { type: "select", name: "side", required: true, values: ["buy", "sell"], maxSelect: 1 },
            { type: "select", name: "token", required: true, values: ["yes", "no"], maxSelect: 1 },
            { type: "number", name: "amount", required: true, min: 0 },
            { type: "number", name: "price", required: true, min: 0, max: 1 },
            { type: "text", name: "strategy", required: true, min: 1, max: 100 },
            { type: "select", name: "mode", required: true, values: ["paper", "live"], maxSelect: 1 },
            { type: "number", name: "pnl" },
            { type: "number", name: "fees", min: 0 },
            { type: "number", name: "slippage", min: 0 },
            { type: "relation", name: "signal_id", collectionId: signals.id, cascadeDelete: false, maxSelect: 1 },
        ],
    });
    app.save(trades);

    // ========== portfolio ==========
    let portfolio = new Collection({
        type: "base",
        name: "portfolio",
        fields: [
            { type: "number", name: "balance", required: true },
            { type: "json", name: "positions" },
            { type: "number", name: "daily_pnl" },
            { type: "number", name: "total_pnl" },
            { type: "number", name: "win_rate", min: 0, max: 1 },
            { type: "number", name: "total_trades", min: 0 },
            { type: "select", name: "mode", required: true, values: ["paper", "live"], maxSelect: 1 },
            { type: "number", name: "peak_balance" },
        ],
    });
    app.save(portfolio);

    // ========== strategy_configs ==========
    let strategyConfigs = new Collection({
        type: "base",
        name: "strategy_configs",
        fields: [
            { type: "text", name: "name", required: true, min: 1, max: 100 },
            { type: "text", name: "description", max: 500 },
            { type: "json", name: "parameters", required: true },
            { type: "bool", name: "active" },
            { type: "select", name: "mode", required: true, values: ["paper", "live"], maxSelect: 1 },
            { type: "number", name: "version", min: 1 },
        ],
    });
    app.save(strategyConfigs);

    // ========== bot_status ==========
    let botStatus = new Collection({
        type: "base",
        name: "bot_status",
        fields: [
            { type: "bool", name: "running" },
            { type: "date", name: "last_heartbeat" },
            { type: "text", name: "current_strategy", max: 100 },
            { type: "select", name: "risk_state", values: ["normal", "caution", "halted"], maxSelect: 1 },
            { type: "select", name: "circuit_breaker_state", values: ["closed", "open", "half_open"], maxSelect: 1 },
            { type: "number", name: "active_positions", min: 0 },
            { type: "number", name: "markets_monitored", min: 0 },
            { type: "date", name: "last_trade_at" },
            { type: "text", name: "last_error", max: 2000 },
            { type: "number", name: "uptime_seconds", min: 0 },
        ],
    });
    app.save(botStatus);

    // ========== Access rules and indexes ==========
    markets = app.findCollectionByNameOrId("markets");
    markets.listRule = "";
    markets.viewRule = "";
    markets.createRule = "@request.auth.id != ''";
    markets.updateRule = "@request.auth.id != ''";
    markets.deleteRule = "@request.auth.id != ''";
    markets.indexes = [
        "CREATE UNIQUE INDEX idx_markets_polymarket_id ON markets (polymarket_id)",
        "CREATE INDEX idx_markets_status ON markets (status)",
    ];
    app.save(markets);

    trades = app.findCollectionByNameOrId("trades");
    trades.listRule = "";
    trades.viewRule = "";
    trades.createRule = "@request.auth.id != ''";
    trades.updateRule = "@request.auth.id != ''";
    trades.deleteRule = "@request.auth.id != ''";
    trades.indexes = [
        "CREATE INDEX idx_trades_market_id ON trades (market_id)",
        "CREATE INDEX idx_trades_mode ON trades (mode)",
        "CREATE INDEX idx_trades_strategy ON trades (strategy)",
        "CREATE INDEX idx_trades_created ON trades (created)",
    ];
    app.save(trades);

    signals = app.findCollectionByNameOrId("signals");
    signals.listRule = "";
    signals.viewRule = "";
    signals.createRule = "@request.auth.id != ''";
    signals.updateRule = "@request.auth.id != ''";
    signals.deleteRule = "@request.auth.id != ''";
    signals.indexes = [
        "CREATE INDEX idx_signals_market_id ON signals (market_id)",
        "CREATE INDEX idx_signals_type ON signals (signal_type)",
        "CREATE INDEX idx_signals_created ON signals (created)",
    ];
    app.save(signals);

    portfolio = app.findCollectionByNameOrId("portfolio");
    portfolio.listRule = "";
    portfolio.viewRule = "";
    portfolio.createRule = "@request.auth.id != ''";
    portfolio.updateRule = "@request.auth.id != ''";
    portfolio.deleteRule = "@request.auth.id != ''";
    portfolio.indexes = [
        "CREATE INDEX idx_portfolio_mode ON portfolio (mode)",
        "CREATE INDEX idx_portfolio_created ON portfolio (created)",
    ];
    app.save(portfolio);

    strategyConfigs = app.findCollectionByNameOrId("strategy_configs");
    strategyConfigs.listRule = "";
    strategyConfigs.viewRule = "";
    strategyConfigs.createRule = "@request.auth.id != ''";
    strategyConfigs.updateRule = "@request.auth.id != ''";
    strategyConfigs.deleteRule = "@request.auth.id != ''";
    strategyConfigs.indexes = [
        "CREATE INDEX idx_strategy_configs_active ON strategy_configs (active)",
        "CREATE INDEX idx_strategy_configs_name ON strategy_configs (name)",
    ];
    app.save(strategyConfigs);

    botStatus = app.findCollectionByNameOrId("bot_status");
    botStatus.listRule = "";
    botStatus.viewRule = "";
    botStatus.createRule = "@request.auth.id != ''";
    botStatus.updateRule = "@request.auth.id != ''";
    botStatus.deleteRule = "@request.auth.id != ''";
    app.save(botStatus);

}, (app) => {
    const collections = [
        "bot_status",
        "strategy_configs",
        "portfolio",
        "trades",
        "signals",
        "markets",
    ];
    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);
            app.delete(collection);
        } catch (e) {}
    }
});
