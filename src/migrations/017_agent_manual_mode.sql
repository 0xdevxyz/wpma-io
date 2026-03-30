-- Migration 017: Add manual_mode and scan_frequency_hours to agent_settings

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS manual_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_mode_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scan_frequency_hours INTEGER NOT NULL DEFAULT 6;
