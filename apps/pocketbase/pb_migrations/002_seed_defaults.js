/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // ========== Create PocketBase Superadmin ==========
    const superusers = app.findCollectionByNameOrId("_superusers");
    const admin = new Record(superusers);
    admin.set("email", "admin@pollytrade.local");
    admin.setPassword("PollyAdmin2024!");
    app.save(admin);
    console.log("Created superadmin: admin@pollytrade.local");

    // ========== Create Default Dashboard User ==========
    const users = app.findCollectionByNameOrId("users");
    const user = new Record(users);
    user.set("email", "trader@pollytrade.local");
    user.set("name", "Default Trader");
    user.setPassword("PollyTrader2024!");
    user.set("verified", true);
    app.save(user);
    console.log("Created dashboard user: trader@pollytrade.local");

    // ========== Seed Default Strategy Config (Conservative) ==========
    const strategyConfigs = app.findCollectionByNameOrId("strategy_configs");
    const config = new Record(strategyConfigs);
    config.set("name", "Conservative");
    config.set("description", "Low-risk strategy with conservative position sizing and strict risk limits");
    config.set("parameters", {
        indicators: {
            zscore: { enabled: true, window: 30, threshold: 2.0, weight: 0.3 },
            entropy: { enabled: true, threshold: 0.5, weight: 0.2 },
            garch: { enabled: true, p: 1, q: 1, weight: 0.3 },
            rsi: { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 0.2 },
        },
        min_confidence: 0.6,
        min_edge: 0.03,
    });
    config.set("active", true);
    config.set("mode", "paper");
    config.set("version", 1);
    app.save(config);
    console.log("Created default strategy config: Conservative");

    // ========== Seed Initial Bot Status ==========
    const botStatus = app.findCollectionByNameOrId("bot_status");
    const status = new Record(botStatus);
    status.set("running", false);
    status.set("current_strategy", "Conservative");
    status.set("risk_state", "normal");
    status.set("circuit_breaker_state", "closed");
    status.set("active_positions", 0);
    status.set("markets_monitored", 0);
    status.set("uptime_seconds", 0);
    app.save(status);
    console.log("Created initial bot status record");

    // ========== Seed Initial Portfolio (Paper) ==========
    const portfolio = app.findCollectionByNameOrId("portfolio");
    const paperPortfolio = new Record(portfolio);
    paperPortfolio.set("balance", 10000.0);
    paperPortfolio.set("positions", []);
    paperPortfolio.set("daily_pnl", 0);
    paperPortfolio.set("total_pnl", 0);
    paperPortfolio.set("win_rate", 0);
    paperPortfolio.set("total_trades", 0);
    paperPortfolio.set("mode", "paper");
    paperPortfolio.set("peak_balance", 10000.0);
    app.save(paperPortfolio);
    console.log("Created initial paper portfolio with $10,000 balance");

}, (app) => {
    // Revert: delete seeded records
    try {
        const superusers = app.findCollectionByNameOrId("_superusers");
        const admin = app.findFirstRecordByFilter(superusers.id, 'email = "admin@pollytrade.local"');
        if (admin) app.delete(admin);
    } catch (e) {}

    try {
        const users = app.findCollectionByNameOrId("users");
        const user = app.findFirstRecordByFilter(users.id, 'email = "trader@pollytrade.local"');
        if (user) app.delete(user);
    } catch (e) {}

    try {
        const strategyConfigs = app.findCollectionByNameOrId("strategy_configs");
        const config = app.findFirstRecordByFilter(strategyConfigs.id, 'name = "Conservative"');
        if (config) app.delete(config);
    } catch (e) {}

    try {
        const botStatus = app.findCollectionByNameOrId("bot_status");
        const records = app.findRecordsByFilter(botStatus.id, "1=1", "", 1, 0);
        for (const record of records) app.delete(record);
    } catch (e) {}

    try {
        const portfolio = app.findCollectionByNameOrId("portfolio");
        const records = app.findRecordsByFilter(portfolio.id, 'mode = "paper"', "", 1, 0);
        for (const record of records) app.delete(record);
    } catch (e) {}
});
