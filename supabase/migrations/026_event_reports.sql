-- Migration: 026_event_reports.sql
-- Creates the event_reports table for post-event client portal reports.

CREATE TABLE IF NOT EXISTS event_reports (
  event_id          UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  curated_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary        TEXT,
  schema_version    INT NOT NULL DEFAULT 1,
  hero_image_url    TEXT,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_at     TIMESTAMPTZ,
  email_sent_to     TEXT
);

-- RLS: service role only
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

-- Index for the send-reports cron (find reports that need emails)
CREATE INDEX IF NOT EXISTS idx_event_reports_unsent
  ON event_reports(generated_at)
  WHERE email_sent_at IS NULL;
