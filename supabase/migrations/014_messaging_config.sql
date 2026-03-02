-- Migration 014: Add messaging_config column to events table
-- Stores per-event messaging timing configuration (pre-event hours, feedback hours, etc.)

ALTER TABLE events
ADD COLUMN IF NOT EXISTS messaging_config jsonb DEFAULT '{}';

COMMENT ON COLUMN events.messaging_config IS
  'Per-event messaging timing config: { pre_event_hours_before, feedback_hours_after, upload_reminder_days }';
