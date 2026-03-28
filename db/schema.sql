-- Mnemo Database Schema
-- Multi-tenant with Row Level Security on every table.
-- tenant_id on every table. Customer A never sees Customer B's data.

-- Enable pgvector for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- TENANTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', -- free, solo, teams, enterprise
    compliance_mode TEXT, -- hipaa, ferpa, coppa, gdpr, soc2, NULL
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_isolation ON tenants
    USING (tenant_id = current_setting('app.tenant_id', true));

-- =============================================================================
-- AGENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    agent_id TEXT NOT NULL,
    name TEXT,
    description TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, agent_id)
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_isolation ON agents
    USING (tenant_id = current_setting('app.tenant_id', true));

-- =============================================================================
-- RUNS
-- =============================================================================
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    agent_id TEXT NOT NULL,
    run_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    session_id TEXT,
    status TEXT NOT NULL DEFAULT 'running', -- running, success, error
    duration_ms DOUBLE PRECISION,
    memories_injected INTEGER DEFAULT 0,
    memories_created INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY runs_isolation ON runs
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX idx_runs_agent ON runs(tenant_id, agent_id);
CREATE INDEX idx_runs_session ON runs(tenant_id, session_id) WHERE session_id IS NOT NULL;

-- =============================================================================
-- TRACES
-- =============================================================================
CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    event TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY traces_isolation ON traces
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX idx_traces_run ON traces(run_id);
CREATE INDEX idx_traces_tenant_time ON traces(tenant_id, timestamp DESC);

-- =============================================================================
-- MEMORIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    agent_id TEXT NOT NULL,
    user_id TEXT,
    memory_type TEXT NOT NULL DEFAULT 'episodic', -- episodic, semantic, pattern
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- for similarity search
    score DOUBLE PRECISION DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ -- for compliance retention policies
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY memories_isolation ON memories
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX idx_memories_agent ON memories(tenant_id, agent_id);
CREATE INDEX idx_memories_user ON memories(tenant_id, agent_id, user_id) WHERE user_id IS NOT NULL;

-- =============================================================================
-- ALERTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    name TEXT NOT NULL,
    condition TEXT NOT NULL, -- latency_high, no_memories, custom, etc.
    severity TEXT NOT NULL DEFAULT 'warning',
    threshold DOUBLE PRECISION,
    webhook_url TEXT,
    message_template TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_rules_isolation ON alert_rules
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    rule_id UUID REFERENCES alert_rules(id),
    run_id TEXT REFERENCES runs(run_id),
    agent_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    fired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_history_isolation ON alert_history
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX idx_alert_history_tenant ON alert_history(tenant_id, fired_at DESC);

-- =============================================================================
-- COMPLIANCE AUDIT LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    agent_id TEXT NOT NULL,
    framework TEXT NOT NULL, -- hipaa, ferpa, coppa, gdpr, soc2
    prompt_hash TEXT NOT NULL, -- SHA-256 hash, never raw content
    response_hash TEXT NOT NULL,
    memories_used INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE compliance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_audit_isolation ON compliance_audit_log
    USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX idx_compliance_tenant ON compliance_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_compliance_agent ON compliance_audit_log(tenant_id, agent_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
