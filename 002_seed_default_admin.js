/// <reference path="../pb_data/types.d.ts" />

// Seeds a default admin (superuser) and a regular dashboard user.
// CHANGE THESE PASSWORDS after first login!

migrate((app) => {
    // ========== Create PocketBase Superadmin ==========
    // This creates the admin account for the PocketBase /_/ admin panel
    const superusers = app.findCollectionByNameOrId("_superusers");
    const admin = new Record(superusers);
    admin.set("email", "admin@secaudit.local");
    admin.setPassword("SecAudit2024!");
    app.save(admin);
    console.log("Created superadmin: admin@secaudit.local / SecAudit2024!");

    // ========== Create Default Dashboard User ==========
    // This creates a regular user for logging into the Angular dashboard
    const users = app.findCollectionByNameOrId("users");
    const user = new Record(users);
    user.set("email", "operator@secaudit.local");
    user.set("name", "Security Operator");
    user.setPassword("Operator2024!");
    user.set("verified", true);
    app.save(user);
    console.log("Created dashboard user: operator@secaudit.local / Operator2024!");

}, (app) => {
    // Revert: delete seeded users
    try {
        const superusers = app.findCollectionByNameOrId("_superusers");
        const admin = app.findFirstRecordByFilter(superusers.id, 'email = "admin@secaudit.local"');
        if (admin) app.delete(admin);
    } catch (e) {}

    try {
        const users = app.findCollectionByNameOrId("users");
        const user = app.findFirstRecordByFilter(users.id, 'email = "operator@secaudit.local"');
        if (user) app.delete(user);
    } catch (e) {}
});
