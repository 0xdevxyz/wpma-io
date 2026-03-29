-- ==========================================
-- WPMA.io Missing Tables Migration
-- Erstellt alle fehlenden Datenbank-Tabellen
-- ==========================================

-- Chat System
CREATE TABLE IF NOT EXISTS chat_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_site_id ON chat_conversations(site_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- Uptime Monitoring
CREATE TABLE IF NOT EXISTS uptime_checks (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  is_up BOOLEAN NOT NULL,
  response_time INTEGER,
  status_code INTEGER,
  error TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_site_id ON uptime_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_checked_at ON uptime_checks(checked_at DESC);

-- Uptime Incidents
CREATE TABLE IF NOT EXISTS uptime_incidents (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  duration INTEGER,
  status VARCHAR(50) DEFAULT 'ongoing',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uptime_incidents_site_id ON uptime_incidents(site_id);

-- Site Settings
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  auto_update_core BOOLEAN DEFAULT false,
  auto_update_plugins BOOLEAN DEFAULT false,
  auto_update_themes BOOLEAN DEFAULT false,
  auto_update_schedule VARCHAR(50) DEFAULT 'weekly',
  email_notification BOOLEAN DEFAULT true,
  backup_before_update BOOLEAN DEFAULT true,
  maintenance_mode BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_settings_site_id ON site_settings(site_id);

-- Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  channels JSONB DEFAULT '{}',
  enabled_events JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- Notification History
CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'sent',
  message TEXT,
  metadata JSONB,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_site_id ON notification_history(site_id);

-- Client Reports
CREATE TABLE IF NOT EXISTS client_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  report_type VARCHAR(50) DEFAULT 'site',
  file_path TEXT,
  file_format VARCHAR(10) DEFAULT 'pdf',
  file_size INTEGER,
  period VARCHAR(50),
  period_start DATE,
  period_end DATE,
  status VARCHAR(50) DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_reports_user_id ON client_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_site_id ON client_reports(site_id);

-- Scheduled Reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  frequency VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  format VARCHAR(10) DEFAULT 'pdf',
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP,
  next_scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user_id ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_scheduled ON scheduled_reports(next_scheduled_at);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) DEFAULT 'team',
  site_limit INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  permissions JSONB DEFAULT '[]',
  invited_at TIMESTAMP,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- White Label Configs
CREATE TABLE IF NOT EXISTS white_label_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  custom_domain VARCHAR(255),
  domain_verified BOOLEAN DEFAULT false,
  domain_verification_token VARCHAR(255),
  custom_css TEXT,
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  email_logo_url TEXT,
  footer_text TEXT,
  support_email VARCHAR(255),
  support_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_white_label_configs_user_id ON white_label_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_white_label_configs_custom_domain ON white_label_configs(custom_domain);

-- Zapier Integrations
CREATE TABLE IF NOT EXISTS zapier_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hook_url TEXT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_zapier_subscriptions_user_id ON zapier_subscriptions(user_id);

-- Update Logs
CREATE TABLE IF NOT EXISTS update_logs (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  update_type VARCHAR(50) NOT NULL,
  component_name VARCHAR(255),
  version_from VARCHAR(50),
  version_to VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_update_logs_site_id ON update_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_update_logs_started_at ON update_logs(started_at DESC);

-- Self-Healing Logs
CREATE TABLE IF NOT EXISTS self_healing_logs (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  context JSONB,
  fix_applied BOOLEAN DEFAULT false,
  fix_type VARCHAR(100),
  fix_description TEXT,
  confidence DECIMAL(3,2),
  status VARCHAR(50) DEFAULT 'analyzed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_self_healing_logs_site_id ON self_healing_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_self_healing_logs_created_at ON self_healing_logs(created_at DESC);

-- Plugin Compatibility
CREATE TABLE IF NOT EXISTS plugin_compatibility (
  id SERIAL PRIMARY KEY,
  plugin_slug VARCHAR(255) NOT NULL,
  compatible_with VARCHAR(255) NOT NULL,
  compatibility_status VARCHAR(50),
  notes TEXT,
  last_tested TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_slug, compatible_with)
);

CREATE INDEX IF NOT EXISTS idx_plugin_compatibility_plugin_slug ON plugin_compatibility(plugin_slug);

-- Erfolgs-Meldung
DO $$
BEGIN
  RAISE NOTICE 'Migration erfolgreich abgeschlossen!';
  RAISE NOTICE 'Alle fehlenden Tabellen wurden erstellt.';
END $$;
