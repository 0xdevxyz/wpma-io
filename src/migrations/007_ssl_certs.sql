-- Migration 007: SSL-Zertifikat-Monitoring
-- Speichert den SSL-Status pro Site, wird täglich aktualisiert

CREATE TABLE IF NOT EXISTS ssl_certs (
    id              SERIAL PRIMARY KEY,
    site_id         INTEGER NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
    domain          VARCHAR(255),
    issuer          VARCHAR(255),
    subject         VARCHAR(255),
    valid_from      TIMESTAMPTZ,
    valid_to        TIMESTAMPTZ,
    days_remaining  INTEGER,
    grade           VARCHAR(2),          -- A, B, C, F
    authorized      BOOLEAN DEFAULT true,
    san             JSONB,               -- Subject Alternative Names
    fingerprint     VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'unknown',
                                         -- valid | warning | critical | expired | error | unknown
    error_message   TEXT,
    last_checked    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssl_certs_site_id ON ssl_certs(site_id);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_status  ON ssl_certs(status);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_days    ON ssl_certs(days_remaining);
