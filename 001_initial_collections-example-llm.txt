/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // ========== users (auth collection) ==========
    // PocketBase v0.25 creates a built-in "users" auth collection on first run.
    const users = app.findCollectionByNameOrId("users");
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.updateRule = "id = @request.auth.id";
    users.deleteRule = "id = @request.auth.id";
    users.createRule = "";
    app.save(users);

    // ========== audit_jobs ==========
    let auditJobs = new Collection({
        type: "base",
        name: "audit_jobs",
        fields: [
            { type: "json", name: "config", required: true },
            { type: "select", name: "status", required: true, values: ["pending", "running", "paused", "completed", "failed", "cancelled"], maxSelect: 1 },
            { type: "number", name: "current_phase", min: 0, max: 10 },
            { type: "number", name: "progress", min: 0, max: 100 },
            { type: "date", name: "started_at" },
            { type: "date", name: "completed_at" },
            { type: "relation", name: "created_by", required: true, collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
        ],
    });
    app.save(auditJobs);

    // ========== audit_steps ==========
    // Re-fetch to get the persisted ID
    auditJobs = app.findCollectionByNameOrId("audit_jobs");

    let auditSteps = new Collection({
        type: "base",
        name: "audit_steps",
        fields: [
            { type: "relation", name: "audit_id", required: true, collectionId: auditJobs.id, cascadeDelete: true, maxSelect: 1 },
            { type: "number", name: "phase", required: true, min: 1, max: 10 },
            { type: "text", name: "tool_name", required: true, min: 1, max: 100 },
            { type: "text", name: "config_name", max: 200 },
            { type: "select", name: "status", required: true, values: ["pending", "running", "completed", "failed", "skipped"], maxSelect: 1 },
            { type: "text", name: "output", max: 5000000 },
            { type: "number", name: "findings_count", min: 0 },
            { type: "date", name: "started_at" },
            { type: "date", name: "completed_at" },
            { type: "number", name: "duration", min: 0 },
        ],
    });
    app.save(auditSteps);

    // ========== findings ==========
    auditSteps = app.findCollectionByNameOrId("audit_steps");

    let findings = new Collection({
        type: "base",
        name: "findings",
        fields: [
            { type: "relation", name: "audit_id", required: true, collectionId: auditJobs.id, cascadeDelete: true, maxSelect: 1 },
            { type: "relation", name: "step_id", collectionId: auditSteps.id, cascadeDelete: false, maxSelect: 1 },
            { type: "select", name: "severity", required: true, values: ["critical", "high", "medium", "low", "info"], maxSelect: 1 },
            { type: "text", name: "title", required: true, min: 1, max: 500 },
            { type: "text", name: "description", max: 50000 },
            { type: "text", name: "tool_name", max: 100 },
            { type: "text", name: "target", max: 2000 },
            { type: "text", name: "cwe_id", max: 20 },
            { type: "number", name: "cvss_score", min: 0, max: 10 },
            { type: "text", name: "evidence", max: 500000 },
            { type: "text", name: "remediation", max: 50000 },
            { type: "select", name: "status", required: true, values: ["open", "confirmed", "false_positive", "accepted", "remediated"], maxSelect: 1 },
        ],
    });
    app.save(findings);

    // ========== reports ==========
    let reports = new Collection({
        type: "base",
        name: "reports",
        fields: [
            { type: "relation", name: "audit_id", required: true, collectionId: auditJobs.id, cascadeDelete: true, maxSelect: 1 },
            { type: "select", name: "type", required: true, values: ["executive_summary", "technical_detail", "compliance", "remediation_plan", "full"], maxSelect: 1 },
            { type: "text", name: "content", max: 10000000 },
            { type: "text", name: "generated_by", max: 100 },
        ],
    });
    app.save(reports);

    // ========== threat_intel_cache ==========
    let threatIntelCache = new Collection({
        type: "base",
        name: "threat_intel_cache",
        fields: [
            { type: "select", name: "source", required: true, values: ["nvd", "epss", "kev", "github_advisory", "osv", "vulncheck"], maxSelect: 1 },
            { type: "text", name: "cve_id", required: true, min: 1, max: 30 },
            { type: "text", name: "vendor", max: 200 },
            { type: "text", name: "product", max: 200 },
            { type: "select", name: "severity", values: ["critical", "high", "medium", "low", "none"], maxSelect: 1 },
            { type: "number", name: "cvss_score", min: 0, max: 10 },
            { type: "text", name: "cvss_vector", max: 200 },
            { type: "number", name: "epss_score", min: 0, max: 1 },
            { type: "bool", name: "is_kev" },
            { type: "json", name: "cwe_ids" },
            { type: "text", name: "description", max: 50000 },
            { type: "json", name: "references" },
            { type: "json", name: "raw_data" },
            { type: "date", name: "fetched_at" },
            { type: "date", name: "expires_at" },
        ],
    });
    app.save(threatIntelCache);

    // ========== scan_profiles ==========
    let scanProfiles = new Collection({
        type: "base",
        name: "scan_profiles",
        fields: [
            { type: "text", name: "name", required: true, min: 1, max: 200 },
            { type: "text", name: "description", max: 5000 },
            { type: "json", name: "config", required: true },
            { type: "bool", name: "is_default" },
            { type: "relation", name: "created_by", collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
        ],
    });
    app.save(scanProfiles);

    // ========== api_keys ==========
    let apiKeys = new Collection({
        type: "base",
        name: "api_keys",
        fields: [
            { type: "text", name: "service", required: true, min: 1, max: 100 },
            { type: "text", name: "key_name", required: true, min: 1, max: 200 },
            { type: "text", name: "encrypted_value", required: true, max: 5000 },
            { type: "relation", name: "created_by", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
        ],
    });
    app.save(apiKeys);

    // ========== Now add API rules and indexes (after all collections exist) ==========
    auditJobs = app.findCollectionByNameOrId("audit_jobs");
    auditJobs.listRule = "created_by = @request.auth.id";
    auditJobs.viewRule = "created_by = @request.auth.id";
    auditJobs.createRule = "@request.auth.id != ''";
    auditJobs.updateRule = "created_by = @request.auth.id";
    auditJobs.deleteRule = "created_by = @request.auth.id";
    auditJobs.indexes = [
        "CREATE INDEX idx_audit_jobs_status ON audit_jobs (status)",
        "CREATE INDEX idx_audit_jobs_created_by ON audit_jobs (created_by)",
    ];
    app.save(auditJobs);

    auditSteps = app.findCollectionByNameOrId("audit_steps");
    auditSteps.listRule = "audit_id.created_by = @request.auth.id";
    auditSteps.viewRule = "audit_id.created_by = @request.auth.id";
    auditSteps.createRule = "@request.auth.id != ''";
    auditSteps.updateRule = "audit_id.created_by = @request.auth.id";
    auditSteps.deleteRule = "audit_id.created_by = @request.auth.id";
    auditSteps.indexes = [
        "CREATE INDEX idx_audit_steps_audit_id ON audit_steps (audit_id)",
        "CREATE INDEX idx_audit_steps_status ON audit_steps (status)",
    ];
    app.save(auditSteps);

    findings = app.findCollectionByNameOrId("findings");
    findings.listRule = "audit_id.created_by = @request.auth.id";
    findings.viewRule = "audit_id.created_by = @request.auth.id";
    findings.createRule = "@request.auth.id != ''";
    findings.updateRule = "audit_id.created_by = @request.auth.id";
    findings.deleteRule = "audit_id.created_by = @request.auth.id";
    findings.indexes = [
        "CREATE INDEX idx_findings_audit_id ON findings (audit_id)",
        "CREATE INDEX idx_findings_severity ON findings (severity)",
        "CREATE INDEX idx_findings_status ON findings (status)",
        "CREATE INDEX idx_findings_cwe_id ON findings (cwe_id)",
    ];
    app.save(findings);

    reports = app.findCollectionByNameOrId("reports");
    reports.listRule = "audit_id.created_by = @request.auth.id";
    reports.viewRule = "audit_id.created_by = @request.auth.id";
    reports.createRule = "@request.auth.id != ''";
    reports.updateRule = "audit_id.created_by = @request.auth.id";
    reports.deleteRule = "audit_id.created_by = @request.auth.id";
    reports.indexes = [
        "CREATE INDEX idx_reports_audit_id ON reports (audit_id)",
    ];
    app.save(reports);

    threatIntelCache = app.findCollectionByNameOrId("threat_intel_cache");
    threatIntelCache.listRule = "@request.auth.id != ''";
    threatIntelCache.viewRule = "@request.auth.id != ''";
    threatIntelCache.createRule = "@request.auth.id != ''";
    threatIntelCache.updateRule = "@request.auth.id != ''";
    threatIntelCache.deleteRule = "@request.auth.id != ''";
    threatIntelCache.indexes = [
        "CREATE UNIQUE INDEX idx_threat_intel_cve_source ON threat_intel_cache (cve_id, source)",
        "CREATE INDEX idx_threat_intel_cve_id ON threat_intel_cache (cve_id)",
        "CREATE INDEX idx_threat_intel_expires ON threat_intel_cache (expires_at)",
    ];
    app.save(threatIntelCache);

    scanProfiles = app.findCollectionByNameOrId("scan_profiles");
    scanProfiles.listRule = "@request.auth.id != ''";
    scanProfiles.viewRule = "@request.auth.id != ''";
    scanProfiles.createRule = "@request.auth.id != ''";
    scanProfiles.updateRule = "created_by = @request.auth.id";
    scanProfiles.deleteRule = "created_by = @request.auth.id";
    scanProfiles.indexes = [
        "CREATE INDEX idx_scan_profiles_name ON scan_profiles (name)",
    ];
    app.save(scanProfiles);

    apiKeys = app.findCollectionByNameOrId("api_keys");
    apiKeys.listRule = "created_by = @request.auth.id";
    apiKeys.viewRule = "created_by = @request.auth.id";
    apiKeys.createRule = "@request.auth.id != ''";
    apiKeys.updateRule = "created_by = @request.auth.id";
    apiKeys.deleteRule = "created_by = @request.auth.id";
    apiKeys.indexes = [
        "CREATE INDEX idx_api_keys_service ON api_keys (service)",
        "CREATE INDEX idx_api_keys_created_by ON api_keys (created_by)",
    ];
    app.save(apiKeys);

}, (app) => {
    const collections = [
        "api_keys",
        "scan_profiles",
        "threat_intel_cache",
        "reports",
        "findings",
        "audit_steps",
        "audit_jobs",
    ];
    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);
            app.delete(collection);
        } catch (e) {}
    }
});
