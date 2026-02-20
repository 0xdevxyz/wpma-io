-- Migration 002: Fehlende Tabellen
-- Erstellt alle Tabellen die im Code referenziert werden aber in keiner Migration existieren

-- site_updates & update_logs (src/routes/updates.js)
CREATE TABLE IF NOT EXISTS site_updates (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    update_type VARCHAR(50) NOT NULL, -- 'plugin', 'theme', 'core'
    item_name VARCHAR(255) NOT NULL,
    from_version VARCHAR(50),
    to_version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, success, failed, rolled_back
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS update_logs (
    id SERIAL PRIMARY KEY,
    site_update_id INTEGER REFERENCES site_updates(id) ON DELETE CASCADE,
    level VARCHAR(20) DEFAULT 'info', -- info, warning, error
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- client_reports & scheduled_reports (src/routes/reports.js)
CREATE TABLE IF NOT EXISTS client_reports (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    report_type VARCHAR(50) DEFAULT 'monthly', -- monthly, weekly, on-demand
    format VARCHAR(20) DEFAULT 'pdf', -- pdf, html
    status VARCHAR(50) DEFAULT 'generating',
    file_path TEXT,
    file_size INTEGER,
    generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly
    format VARCHAR(20) DEFAULT 'pdf',
    recipients JSONB DEFAULT '[]',
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- uptime_checks (src/routes/monitoring.js)
CREATE TABLE IF NOT EXISTS uptime_checks (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- up, down, degraded
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT NOW()
);

-- teams (src/routes/team.js)
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'support', -- owner, admin, developer, support, client
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id, user_id, site_id)
);

CREATE TABLE IF NOT EXISTS team_invites (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'support',
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- white_label_configs (src/routes/whiteLabel.js)
CREATE TABLE IF NOT EXISTS white_label_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#3B82F6',
    secondary_color VARCHAR(20) DEFAULT '#1E40AF',
    custom_domain VARCHAR(255),
    custom_css TEXT,
    email_from_name VARCHAR(255),
    email_from_address VARCHAR(255),
    email_template TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- notification_settings & notification_logs (src/routes/notifications.js)
CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- email, slack, discord, webhook, zapier
    config JSONB DEFAULT '{}',
    events JSONB DEFAULT '["downtime","security","updates"]',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, site_id, channel)
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'sent', -- sent, failed
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zapier_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    hook_url TEXT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- vulnerability_alerts (src/routes/security.js)
CREATE TABLE IF NOT EXISTS vulnerability_alerts (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    vulnerability_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- critical, high, medium, low
    component_type VARCHAR(50), -- plugin, theme, core
    component_name VARCHAR(255),
    component_version VARCHAR(50),
    cve_id VARCHAR(50),
    description TEXT,
    fix_recommendation TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, dismissed, resolved
    dismissed_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ai_conversations & ai_messages (src/routes/chat.js)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    title VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- user, assistant
    content TEXT NOT NULL,
    intent VARCHAR(100),
    action_taken VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- incremental_backups (src/routes/incrementalBackup.js)
CREATE TABLE IF NOT EXISTS incremental_backups (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    backup_type VARCHAR(50) DEFAULT 'incremental', -- incremental, full
    status VARCHAR(50) DEFAULT 'running', -- running, completed, failed
    provider VARCHAR(50), -- s3, e2, local
    file_path TEXT,
    file_size BIGINT,
    checksum VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_site_updates_site_id ON site_updates(site_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_site_id ON uptime_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_checked_at ON uptime_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_vulnerability_alerts_site_id ON vulnerability_alerts(site_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_alerts_status ON vulnerability_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_incremental_backups_site_id ON incremental_backups(site_id);
