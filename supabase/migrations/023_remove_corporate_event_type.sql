-- ============================================
-- Migration 023: Remove corporate event type
-- Drops 'corporate' from the event_type check constraint.
-- Any existing corporate events are migrated to 'other'.
-- ============================================

-- Migrate any existing corporate events to 'other'
UPDATE events SET event_type = 'other' WHERE event_type = 'corporate';
UPDATE event_requests SET event_type = 'other' WHERE event_type = 'corporate';

-- Recreate constraint without 'corporate'
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_event_type;
ALTER TABLE events ADD CONSTRAINT chk_event_type
  CHECK (event_type IN ('wedding','party','meetup','other'));
