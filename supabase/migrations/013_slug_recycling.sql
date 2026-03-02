-- Migration 013: Slug recycling for pretty URLs
-- Per design doc §28.7 — allow archived events to free their slugs

-- Drop the existing unique constraint on events.slug
-- (Supabase auto-creates events_slug_key from the UNIQUE in schema.sql)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_slug_key;

-- Partial unique index: slugs must be unique among non-archived events only
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug_active
  ON events (slug)
  WHERE status != 'archived';

-- Regular (non-unique) index for slug lookups across all events
CREATE INDEX IF NOT EXISTS idx_events_slug_all
  ON events (slug);

-- Store the original slug before recycling (for audit trail)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS original_slug TEXT DEFAULT NULL;
