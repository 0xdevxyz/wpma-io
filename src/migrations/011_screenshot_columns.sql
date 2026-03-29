-- Add screenshot columns to sites table
-- Migration: add_screenshot_columns.sql

ALTER TABLE sites ADD COLUMN IF NOT EXISTS screenshot TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS screenshot_updated_at TIMESTAMP;

-- Create index for faster screenshot lookups
CREATE INDEX IF NOT EXISTS idx_sites_screenshot_updated ON sites(screenshot_updated_at);

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: add_screenshot_columns.sql';
END $$;
