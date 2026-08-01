-- Migration: 027_moderation.sql
-- Adds image moderation fields to participant_photos and creates moderation_review_queue.

-- Add moderation columns to participant_photos
ALTER TABLE participant_photos
  ADD COLUMN IF NOT EXISTS moderation_score       FLOAT,
  ADD COLUMN IF NOT EXISTS moderation_label       TEXT,
  ADD COLUMN IF NOT EXISTS moderation_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'review')),
  ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ;

-- Index for recheck cron (find un-moderated photos)
CREATE INDEX IF NOT EXISTS idx_photos_moderation_pending
  ON participant_photos(moderation_status, created_at)
  WHERE moderation_status = 'pending';

-- Moderation review queue (photos and messages flagged for human review)
CREATE TABLE IF NOT EXISTS moderation_review_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL CHECK (item_type IN ('photo', 'message')),
  photo_id        UUID REFERENCES participant_photos(id) ON DELETE CASCADE,
  message_id      UUID REFERENCES messages(id) ON DELETE CASCADE,
  score           FLOAT,
  label           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_item_reference CHECK (
    (item_type = 'photo' AND photo_id IS NOT NULL) OR
    (item_type = 'message' AND message_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_pending
  ON moderation_review_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_moderation_queue_event
  ON moderation_review_queue(event_id, status);

-- RLS: service role only
ALTER TABLE moderation_review_queue ENABLE ROW LEVEL SECURITY;
