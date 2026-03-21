-- Migration 003: Content Publishing Hub
-- Tabellen für Content Engine, Project Registry und Publisher

-- content_projects: Project Registry (verschiedene Ziel-Typen)
CREATE TABLE IF NOT EXISTS content_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL, -- optionaler Link zu WP-Site
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'wordpress', -- wordpress, static_html, webflow, custom
    url VARCHAR(500),
    config JSONB DEFAULT '{}',
    -- wordpress: { wp_url, wp_user, wp_app_password }
    -- static_html: { agent_url } -> wird per HMAC angesprochen
    -- custom: { webhook_url }
    agent_token VARCHAR(255) UNIQUE,       -- Plaintext Token (nur bei Erstellung zurückgeben)
    agent_token_hash VARCHAR(255),         -- bcrypt Hash für sichere Speicherung
    ip_whitelist JSONB DEFAULT '[]',       -- Optionale IP-Whitelist
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_projects_user_id ON content_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_content_projects_site_id ON content_projects(site_id);

-- content_posts: Generierte und publizierte Inhalte
CREATE TABLE IF NOT EXISTS content_posts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES content_projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    keywords TEXT[] DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'de',
    status VARCHAR(50) DEFAULT 'draft', -- draft, publishing, published, failed
    remote_id VARCHAR(255),             -- ID beim Ziel (WP Post ID, etc.)
    remote_url TEXT,                    -- URL des veröffentlichten Posts
    published_at TIMESTAMP,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_posts_project_id ON content_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_user_id ON content_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON content_posts(status);

-- content_media: Pexels-Bildauswahl pro Post
CREATE TABLE IF NOT EXISTS content_media (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES content_posts(id) ON DELETE CASCADE,
    pexels_id VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt_text TEXT,
    photographer VARCHAR(255),
    photographer_url TEXT,
    width INTEGER,
    height INTEGER,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_media_post_id ON content_media(post_id);

-- publish_jobs: Publishing-Verlauf und Status
CREATE TABLE IF NOT EXISTS publish_jobs (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES content_posts(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES content_projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, success, failed
    adapter_type VARCHAR(50) NOT NULL,    -- wordpress, static_html, webhook
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_post_id ON publish_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_user_id ON publish_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_status ON publish_jobs(status);
