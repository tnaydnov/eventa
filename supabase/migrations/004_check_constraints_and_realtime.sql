-- Migration 004: CHECK constraints + realtime publication fixes
-- Adds DB-level validation for event_type and status columns,
-- adds events to realtime publication, removes participant_photos from it.

-- ============================================
-- CHECK CONSTRAINTS
-- ============================================

-- Enforce valid event_type values at DB level
ALTER TABLE events
  ADD CONSTRAINT chk_event_type
  CHECK (event_type IN ('wedding','party','brit','bar_mitzvah','corporate','meetup','other'));

-- Enforce valid event status values at DB level
ALTER TABLE events
  ADD CONSTRAINT chk_event_status
  CHECK (status IN ('draft','active','paused','ended','archived'));

-- ============================================
-- REALTIME PUBLICATION FIXES
-- ============================================

-- Add events table to realtime (needed for background_image / name change subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Remove participant_photos from realtime (no client subscribes to it)
ALTER PUBLICATION supabase_realtime DROP TABLE participant_photos;
