/// <reference path="../pb_data/types.d.ts" />

// Open up API rules for all collections so the frontend wizard
// can create/update records without authentication.
// This is a single-user paper trading app, no auth needed.

migrate((app) => {
    const collections = [
        "strategy_configs",
        "portfolio",
        "bot_status",
        "trades",
        "signals",
        "markets",
    ];

    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);
            collection.listRule = "";
            collection.viewRule = "";
            collection.createRule = "";
            collection.updateRule = "";
            collection.deleteRule = "";
            app.save(collection);
        } catch (e) {
            // Collection might not exist yet
        }
    }
}, (app) => {
    // Revert: require auth for write operations
    const collections = [
        "strategy_configs",
        "portfolio",
        "bot_status",
        "trades",
        "signals",
        "markets",
    ];

    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);
            collection.listRule = "";
            collection.viewRule = "";
            collection.createRule = "@request.auth.id != ''";
            collection.updateRule = "@request.auth.id != ''";
            collection.deleteRule = "@request.auth.id != ''";
            app.save(collection);
        } catch (e) {}
    }
});
