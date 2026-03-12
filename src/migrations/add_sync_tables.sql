-- Erweitere sites Tabelle um Sync-Felder
ALTER TABLE sites ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS core_update_available BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS core_update_version VARCHAR(50);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ssl_enabled BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS security_score INTEGER DEFAULT 0;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS security_issues JSONB DEFAULT '[]';

-- Tabelle für gecachte Plugins
CREATE TABLE IF NOT EXISTS site_plugins (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    status VARCHAR(20),
    update_available BOOLEAN DEFAULT false,
    update_version VARCHAR(50),
    author VARCHAR(255),
    description TEXT,
    synced_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

-- Tabelle für gecachte Themes
CREATE TABLE IF NOT EXISTS site_themes (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    status VARCHAR(20),
    update_available BOOLEAN DEFAULT false,
    update_version VARCHAR(50),
    author VARCHAR(255),
    description TEXT,
    synced_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

-- Tabelle für Site-Statistiken
CREATE TABLE IF NOT EXISTS site_stats (
    site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
    posts_count INTEGER DEFAULT 0,
    pages_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    users_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_site_plugins_site_id ON site_plugins(site_id);
CREATE INDEX IF NOT EXISTS idx_site_plugins_status ON site_plugins(status);
CREATE INDEX IF NOT EXISTS idx_site_plugins_update ON site_plugins(update_available);

CREATE INDEX IF NOT EXISTS idx_site_themes_site_id ON site_themes(site_id);
CREATE INDEX IF NOT EXISTS idx_site_themes_status ON site_themes(status);
CREATE INDEX IF NOT EXISTS idx_site_themes_update ON site_themes(update_available);

CREATE INDEX IF NOT EXISTS idx_sites_last_sync ON sites(last_sync_at);
