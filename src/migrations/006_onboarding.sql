-- Migration 006: Onboarding Flow + Telegram
-- Sequenzieller Setup-Flow nach Plugin-Verbindung

-- Onboarding-Status auf der Site
ALTER TABLE sites ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(30) DEFAULT 'pending';
-- Values: pending | in_progress | completed | failed

-- Schritt-Protokoll pro Site
CREATE TABLE IF NOT EXISTS site_onboarding_steps (
    id          SERIAL PRIMARY KEY,
    site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    step        VARCHAR(50) NOT NULL,
    -- malware_scan | backup | health_and_update | functional_check | rollback
    status      VARCHAR(20) DEFAULT 'pending',
    -- pending | running | completed | failed | skipped | needs_license
    result      JSONB,
    error       TEXT,
    started_at  TIMESTAMP,
    completed_at TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_site ON site_onboarding_steps(site_id);

-- Premium-Plugin-Lizenzanfragen (Schritt 3 pausiert hier)
CREATE TABLE IF NOT EXISTS pending_license_requests (
    id          SERIAL PRIMARY KEY,
    site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    plugin_slug VARCHAR(255) NOT NULL,
    plugin_name VARCHAR(255) NOT NULL,
    license_key TEXT,                        -- NULL = noch ausstehend
    status      VARCHAR(20) DEFAULT 'pending', -- pending | provided | skipped
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Telegram-Felder in users (für direkte Nutzer-Benachrichtigung)
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);

-- notification_settings: telegram-Kanal wird als JSONB-Eintrag gespeichert (bestehende Struktur)
-- Kein Schema-Change nötig, channels JSONB nimmt telegram-Objekt auf
