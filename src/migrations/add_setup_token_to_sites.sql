-- Migration: Add Setup Token columns to sites table
-- Date: 2025-10-15
-- Description: Adds columns for one-time setup token functionality

ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS setup_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS setup_token_used BOOLEAN DEFAULT false;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_sites_setup_token ON sites(setup_token) WHERE setup_token IS NOT NULL;

-- Add column for tracking last plugin connection
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS last_plugin_connection TIMESTAMP;

-- Add column for tracking plugin version
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS plugin_version VARCHAR(20);

COMMENT ON COLUMN sites.setup_token IS 'One-time token for automatic plugin setup';
COMMENT ON COLUMN sites.setup_token_expires_at IS 'Expiration timestamp for setup token (1 hour from generation)';
COMMENT ON COLUMN sites.setup_token_used IS 'Flag indicating if token has been used';
COMMENT ON COLUMN sites.last_plugin_connection IS 'Last time plugin connected to API';
COMMENT ON COLUMN sites.plugin_version IS 'Version of installed WPMA Agent plugin';

