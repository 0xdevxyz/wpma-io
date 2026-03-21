-- Initial Schema for WPMA
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    plan_type VARCHAR(50) DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    subscription_current_period_end TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    site_url VARCHAR(500),
    site_name VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    setup_token VARCHAR(64),
    setup_token_expires_at TIMESTAMP,
    setup_token_used BOOLEAN DEFAULT false,
    last_plugin_connection TIMESTAMP,
    plugin_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_api_key ON sites(api_key);
CREATE INDEX IF NOT EXISTS idx_sites_setup_token ON sites(setup_token) WHERE setup_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
