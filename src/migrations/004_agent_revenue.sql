-- Migration 004: Autonomer KI-Agent + WooCommerce Revenue Intelligence
-- Run once at startup via database.js

-- ============================================================
-- AUTONOMER KI-AGENT
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_tasks (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'detected',
    -- detected -> analyzing -> action_planned -> awaiting_approval -> executing -> done | failed | rejected
    severity VARCHAR(16) NOT NULL DEFAULT 'medium', -- low | medium | high | critical
    category VARCHAR(64) NOT NULL, -- performance | security | uptime | plugin | core | woocommerce
    title TEXT NOT NULL,
    description TEXT,
    ai_analysis JSONB,        -- Claude's full analysis
    action_plan JSONB,        -- array of planned steps
    execution_log JSONB,      -- step-by-step execution results
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    completed_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_actions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES agent_tasks(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    action_type VARCHAR(64) NOT NULL, -- rollback_plugin | update_plugin | clear_cache | disable_plugin | fix_config | notify
    action_label TEXT NOT NULL,
    payload JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending | running | done | failed | skipped
    result JSONB,
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    auto_approve_low BOOLEAN NOT NULL DEFAULT TRUE,   -- auto-approve low severity
    auto_approve_medium BOOLEAN NOT NULL DEFAULT FALSE,
    auto_approve_high BOOLEAN NOT NULL DEFAULT FALSE,
    auto_approve_critical BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_detection BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_completion BOOLEAN NOT NULL DEFAULT TRUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- WOOCOMMERCE REVENUE INTELLIGENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_snapshots (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    -- WooCommerce core metrics
    total_revenue DECIMAL(12,2) DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,  -- 0.0312 = 3.12%
    cart_abandonment_rate DECIMAL(5,4) DEFAULT 0,
    refund_amount DECIMAL(12,2) DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    -- Technical snapshot at same time (for correlation)
    page_load_ms INTEGER,
    uptime_pct DECIMAL(5,2),
    error_rate DECIMAL(5,4),
    -- Raw data for AI analysis
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_correlations (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    detected_at TIMESTAMP DEFAULT NOW(),
    correlation_type VARCHAR(64) NOT NULL, -- performance_drop | plugin_update | downtime | security_issue
    trigger_event TEXT NOT NULL,           -- "Plugin WooCommerce Payments updated to 6.4"
    trigger_at TIMESTAMP NOT NULL,
    revenue_before DECIMAL(12,2),          -- avg daily revenue 7 days before
    revenue_after DECIMAL(12,2),           -- avg daily revenue 7 days after
    revenue_delta_pct DECIMAL(6,2),        -- -23.5 = 23.5% drop
    revenue_loss_estimated DECIMAL(12,2),  -- estimated loss in €
    confidence DECIMAL(4,3),               -- 0.0 - 1.0
    ai_explanation TEXT,
    ai_recommendation TEXT,
    action_taken TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS woocommerce_events (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL, -- order_placed | order_refunded | cart_abandoned | checkout_failed
    event_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revenue_amount DECIMAL(10,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_agent_tasks_site_id ON agent_tasks(site_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_task_id ON agent_actions(task_id);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_site_id ON revenue_snapshots(site_id);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_at ON revenue_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_revenue_correlations_site_id ON revenue_correlations(site_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_events_site_id ON woocommerce_events(site_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_events_at ON woocommerce_events(event_at);
