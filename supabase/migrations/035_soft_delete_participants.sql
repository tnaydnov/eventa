-- Migration: 035_soft_delete_participants.sql
-- Adds soft-delete support to participants.
-- Deleted users stay in the DB for analytics but are hidden from the app.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Fast lookup: "active" participants (not deleted, not banned)
CREATE INDEX IF NOT EXISTS idx_participants_active
  ON participants(event_id)
  WHERE deleted_at IS NULL AND is_banned = false;

-- Fast count of deleted participants per event (for analytics)
CREATE INDEX IF NOT EXISTS idx_participants_deleted
  ON participants(event_id)
  WHERE deleted_at IS NOT NULL;
