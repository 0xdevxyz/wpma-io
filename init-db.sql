-- WPMA Database Schema
-- Initialisierungs-Script

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    site_url VARCHAR(500) NOT NULL,
    site_name VARCHAR(255),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    health_score INTEGER DEFAULT 100,
    wordpress_version VARCHAR(50),
    php_version VARCHAR(50),
    ssl_enabled BOOLEAN DEFAULT false,
    last_check TIMESTAMP,
    last_sync TIMESTAMP,
    setup_token VARCHAR(255),
    setup_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);

-- Test User erstellen
INSERT INTO users (email, password, name, role) 
VALUES ('admin@wpma.io', '$2a$10$abcdefghijklmnopqrstuOxMSI.JxS2yPx7CnJ/ZH8qxWxZ2', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Password ist "admin123" gehashed
UPDATE users SET password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' WHERE email = 'admin@wpma.io';
