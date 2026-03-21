-- Migration 008: Backup Schedules & Storage Quotas

-- Per-site auto-backup schedule
CREATE TABLE IF NOT EXISTS backup_schedules (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'off',  -- off, daily, weekly, monthly
    backup_type VARCHAR(20) NOT NULL DEFAULT 'full',    -- full, database, files
    hour INTEGER NOT NULL DEFAULT 2,                    -- 0-23, UTC
    day_of_week INTEGER DEFAULT 1,                      -- 0=Sun..6=Sat (weekly only)
    day_of_month INTEGER DEFAULT 1,                     -- 1-28 (monthly only)
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (site_id)
);

-- Per-user storage quota
CREATE TABLE IF NOT EXISTS backup_storage_quotas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    quota_bytes BIGINT NOT NULL DEFAULT 1073741824,   -- 1 GB
    used_bytes BIGINT NOT NULL DEFAULT 0,
    max_backups_per_site INTEGER NOT NULL DEFAULT 5,
    tier INTEGER NOT NULL DEFAULT 1,                  -- 1=1GB 2=2GB 3=5GB 4=10GB
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);
