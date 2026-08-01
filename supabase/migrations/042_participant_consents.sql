-- Migration: 042_participant_consents.sql
-- Durable, versioned consent records per participant.
--
-- The join flow already gates entry behind a required consent checkbox
-- (terms + privacy + cookies + marketing-photography notice). This table
-- stores immutable evidence of that consent so we can prove WHICH version of
-- each document a participant agreed to, and WHEN.

CREATE TABLE IF NOT EXISTS participant_consents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id   UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  terms_version    TEXT NOT NULL,
  privacy_version  TEXT NOT NULL,
  cookies_version  TEXT,
  accepted_at      TIMESTAMPTZ NOT NULL,
  user_agent       TEXT,
  ip_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: service role only (no anon access). Consent evidence is sensitive.
ALTER TABLE participant_consents ENABLE ROW LEVEL SECURITY;

-- Lookup a participant's consent history.
CREATE INDEX IF NOT EXISTS idx_participant_consents_participant
  ON participant_consents(participant_id, created_at DESC);

-- Lookup all consents for an event (audit / export).
CREATE INDEX IF NOT EXISTS idx_participant_consents_event
  ON participant_consents(event_id);
