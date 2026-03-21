-- Plugin und Theme Tracking Tabellen

CREATE TABLE IF NOT EXISTS plugins (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  plugin_slug VARCHAR(255) NOT NULL,
  plugin_name VARCHAR(255) NOT NULL,
  plugin_version VARCHAR(50),
  is_active BOOLEAN DEFAULT false,
  is_network_active BOOLEAN DEFAULT false,
  update_available BOOLEAN DEFAULT false,
  new_version VARCHAR(50),
  author VARCHAR(255),
  author_uri TEXT,
  description TEXT,
  plugin_uri TEXT,
  requires_wp VARCHAR(50),
  requires_php VARCHAR(50),
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, plugin_slug)
);

CREATE INDEX IF NOT EXISTS idx_plugins_site_id ON plugins(site_id);
CREATE INDEX IF NOT EXISTS idx_plugins_update_available ON plugins(update_available);
CREATE INDEX IF NOT EXISTS idx_plugins_is_active ON plugins(is_active);

CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  theme_slug VARCHAR(255) NOT NULL,
  theme_name VARCHAR(255) NOT NULL,
  theme_version VARCHAR(50),
  is_active BOOLEAN DEFAULT false,
  update_available BOOLEAN DEFAULT false,
  new_version VARCHAR(50),
  author VARCHAR(255),
  author_uri TEXT,
  description TEXT,
  theme_uri TEXT,
  template VARCHAR(255),
  screenshot TEXT,
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, theme_slug)
);

CREATE INDEX IF NOT EXISTS idx_themes_site_id ON themes(site_id);
CREATE INDEX IF NOT EXISTS idx_themes_update_available ON themes(update_available);
CREATE INDEX IF NOT EXISTS idx_themes_is_active ON themes(is_active);

-- WordPress Users Tracking
CREATE TABLE IF NOT EXISTS wp_users (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  wp_user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  display_name VARCHAR(255),
  role VARCHAR(50),
  registered_date TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, wp_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wp_users_site_id ON wp_users(site_id);
CREATE INDEX IF NOT EXISTS idx_wp_users_role ON wp_users(role);

DO $$
BEGIN
  RAISE NOTICE 'Plugin/Theme/User Tracking-Tabellen erfolgreich erstellt!';
END $$;
