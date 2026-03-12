-- Migration: Maintenance Reports & Scheduling

-- Maintenance Reports Table
CREATE TABLE IF NOT EXISTS maintenance_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    filepath TEXT NOT NULL,
    format VARCHAR(10) DEFAULT 'pdf',
    file_size BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_user ON maintenance_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_site ON maintenance_reports(site_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_created ON maintenance_reports(created_at);

-- Report Schedules Table
CREATE TABLE IF NOT EXISTS report_schedules (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    frequency VARCHAR(20) DEFAULT 'monthly',
    format VARCHAR(10) DEFAULT 'pdf',
    recipients JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
    CONSTRAINT check_format CHECK (format IN ('pdf', 'html', 'json')),
    UNIQUE(site_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_site ON report_schedules(site_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active);

-- Comments
COMMENT ON TABLE maintenance_reports IS 'Stores generated maintenance reports for download';
COMMENT ON TABLE report_schedules IS 'Manages automatic report generation schedules';
