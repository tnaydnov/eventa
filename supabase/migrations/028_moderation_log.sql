-- Migration: 028_moderation_log.sql
-- Adds the moderation_log table (full audit trail per §14.6).
-- Also adds moderation_scores column to participant_photos for per-category score storage.

-- Store full per-category scores on photos (was just a single float before)
ALTER TABLE participant_photos
  ADD COLUMN IF NOT EXISTS moderation_scores JSONB;

-- Full moderation audit log - one row per upload decision
CREATE TABLE IF NOT EXISTS moderation_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID        REFERENCES events(id) ON DELETE CASCADE,
  participant_id     UUID,
  surface            TEXT        NOT NULL CHECK (surface IN ('profile_photo', 'chat_image')),
  storage_path       TEXT        NOT NULL,
  decision           TEXT        NOT NULL CHECK (decision IN ('allowed', 'blocked', 'shadow_review', 'deferred')),
  reason             TEXT,                            -- category that triggered (NULL when allowed)
  scores             JSONB       NOT NULL DEFAULT '{}', -- raw OpenAI per-category scores
  second_opinion     JSONB,                           -- { label, score } when Falconsai ran, else NULL
  model              TEXT        NOT NULL DEFAULT 'openai',  -- 'openai' | 'openai+falconsai' | 'none'
  admin_overridden   BOOLEAN     NOT NULL DEFAULT FALSE,
  admin_action       TEXT        CHECK (admin_action IN ('kept', 'removed')),
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For admin shadow-review queue: pending items for a given event
CREATE INDEX IF NOT EXISTS idx_modlog_review_queue
  ON moderation_log(event_id, created_at)
  WHERE decision = 'shadow_review' AND admin_action IS NULL;

-- For blocked-queue false-positive recovery
CREATE INDEX IF NOT EXISTS idx_modlog_blocked
  ON moderation_log(event_id, created_at)
  WHERE decision = 'blocked';

-- For threshold tuning: score histogram queries
CREATE INDEX IF NOT EXISTS idx_modlog_event_decision
  ON moderation_log(event_id, decision, created_at);

-- Participants table: add flagged_for_review for repeat-offender detection (§14.8)
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flagged_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_participants_flagged
  ON participants(event_id, flagged_for_review)
  WHERE flagged_for_review = TRUE;

-- RLS: moderation_log and flag columns are service-role only
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;

-- No SELECT policy = service role only (admins go via service client)
