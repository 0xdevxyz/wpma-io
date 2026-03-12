-- Migration: Self-Healing & Rollback Tables
-- Created: 2025-02-13

-- Self-Healing Fixes Table
CREATE TABLE IF NOT EXISTS selfhealing_fixes (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    fix_type VARCHAR(50) NOT NULL,
    fix_code TEXT NOT NULL,
    description TEXT,
    confidence DECIMAL(3,2) DEFAULT 0.7,
    status VARCHAR(20) DEFAULT 'pending',
    applied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_selfhealing_status CHECK (status IN ('pending', 'applied', 'failed', 'rolled_back'))
);

CREATE INDEX IF NOT EXISTS idx_selfhealing_fixes_site ON selfhealing_fixes(site_id);
CREATE INDEX IF NOT EXISTS idx_selfhealing_fixes_status ON selfhealing_fixes(status);

-- Staging Environments Table
CREATE TABLE IF NOT EXISTS staging_environments (
    id SERIAL PRIMARY KEY,
    source_site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staging_domain VARCHAR(255),
    staging_url TEXT,
    status VARCHAR(50) DEFAULT 'creating',
    progress_message TEXT,
    created_from_backup UUID,
    activated_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_staging_status CHECK (status IN ('creating', 'creating_backup', 'creating_database', 'copying_files', 'updating_urls', 'finalizing', 'active', 'failed', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_staging_source_site ON staging_environments(source_site_id);
CREATE INDEX IF NOT EXISTS idx_staging_status ON staging_environments(status);

-- Staging Sync Jobs Table
CREATE TABLE IF NOT EXISTS staging_sync_jobs (
    id SERIAL PRIMARY KEY,
    staging_id INTEGER NOT NULL REFERENCES staging_environments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_message TEXT,
    options JSONB DEFAULT '{}',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_sync_direction CHECK (direction IN ('push', 'pull')),
    CONSTRAINT check_sync_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_staging ON staging_sync_jobs(staging_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON staging_sync_jobs(status);

-- Clone Jobs Table
CREATE TABLE IF NOT EXISTS clone_jobs (
    id SERIAL PRIMARY KEY,
    source_site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_domain VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_message TEXT,
    options JSONB DEFAULT '{}',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_clone_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_clone_jobs_source_site ON clone_jobs(source_site_id);
CREATE INDEX IF NOT EXISTS idx_clone_jobs_status ON clone_jobs(status);

-- Migration Jobs Table
CREATE TABLE IF NOT EXISTS migration_jobs (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    hosting_provider VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    progress_message TEXT,
    backup_id UUID,
    search_replace_sql TEXT,
    wp_config_changes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_migration_status CHECK (status IN ('pending', 'generating', 'ready', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_site ON migration_jobs(site_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);

-- Incremental Backups Table
CREATE TABLE IF NOT EXISTS incremental_backups (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    parent_backup_id INTEGER REFERENCES incremental_backups(id) ON DELETE SET NULL,
    backup_type VARCHAR(20) DEFAULT 'incremental',
    status VARCHAR(50) DEFAULT 'pending',
    progress_message TEXT,
    file_size BIGINT DEFAULT 0,
    changes_count INTEGER DEFAULT 0,
    changes_data JSONB,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_backup_type CHECK (backup_type IN ('full', 'incremental')),
    CONSTRAINT check_backup_status CHECK (status IN ('pending', 'creating', 'processing', 'uploading', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_incremental_backups_site ON incremental_backups(site_id);
CREATE INDEX IF NOT EXISTS idx_incremental_backups_parent ON incremental_backups(parent_backup_id);
CREATE INDEX IF NOT EXISTS idx_incremental_backups_type ON incremental_backups(backup_type);

-- Backup Checksums Table
CREATE TABLE IF NOT EXISTS backup_checksums (
    backup_id INTEGER PRIMARY KEY REFERENCES incremental_backups(id) ON DELETE CASCADE,
    checksums JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-Time Backup Config Table
CREATE TABLE IF NOT EXISTS realtime_backup_config (
    site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    watch_interval INTEGER DEFAULT 300,
    exclude_patterns JSONB DEFAULT '[]',
    max_daily_backups INTEGER DEFAULT 48,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restore Jobs Table
CREATE TABLE IF NOT EXISTS restore_jobs (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_timestamp TIMESTAMP NOT NULL,
    backup_chain JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress_message TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_restore_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_restore_jobs_site ON restore_jobs(site_id);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_status ON restore_jobs(status);

-- Update Logs Table (falls noch nicht existiert)
CREATE TABLE IF NOT EXISTS update_logs (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    update_data JSONB,
    result_data JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    rolled_back_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_update_status CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'rolled_back'))
);

CREATE INDEX IF NOT EXISTS idx_update_logs_site ON update_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_update_logs_status ON update_logs(status);

-- Site Updates Table (für verfügbare Updates)
CREATE TABLE IF NOT EXISTS site_updates (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    update_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_updates_site ON site_updates(site_id);

-- Site Settings Table (generisch für alle Settings)
CREATE TABLE IF NOT EXISTS site_settings (
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (site_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_site_settings_site ON site_settings(site_id);

-- Comments
COMMENT ON TABLE selfhealing_fixes IS 'Stores AI-generated fixes for WordPress problems';
COMMENT ON TABLE staging_environments IS 'Manages staging environments for WordPress sites';
COMMENT ON TABLE staging_sync_jobs IS 'Tracks push/pull operations between staging and live';
COMMENT ON TABLE incremental_backups IS 'Stores incremental and point-in-time backup data';
COMMENT ON TABLE restore_jobs IS 'Tracks point-in-time restore operations';
COMMENT ON TABLE realtime_backup_config IS 'Configuration for real-time backup monitoring';
