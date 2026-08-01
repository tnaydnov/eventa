-- ============================================
-- Migration: Admin Dashboard Phase 1
-- Adds event_type, status, description, archived_at to events
-- Creates activity_log and event_analytics_snapshots tables
-- ============================================

-- 1. Extend events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'wedding';
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Sync status with is_active for existing events
UPDATE events SET status = 'paused' WHERE is_active = false AND status = 'active';

-- 2. Activity Log (heartbeats + action tracking for usage timeline)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_event_time ON activity_log(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_participant ON activity_log(participant_id);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon - service_role only

-- 3. Event Analytics Snapshots (preserved after archiving/purging user data)
CREATE TABLE IF NOT EXISTS event_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

ALTER TABLE event_analytics_snapshots ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon - service_role only
