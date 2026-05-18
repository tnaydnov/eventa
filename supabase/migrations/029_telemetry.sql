-- Migration: 029_telemetry.sql
-- Creates event_vitals and event_errors tables for persisting client telemetry.
-- Adds idempotency_key column to messages for retry deduplication.

-- ─── event_vitals ────────────────────────────────────────────────────────────
-- Stores Core Web Vitals reported by clients via /api/telemetry/vitals.
-- event_id is nullable because the browser may not have a session at report time.
CREATE TABLE IF NOT EXISTS event_vitals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        REFERENCES events(id) ON DELETE CASCADE,
  metric_name text        NOT NULL,
  value       float8      NOT NULL,
  rating      text        CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  url         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_vitals_created
  ON event_vitals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_vitals_event
  ON event_vitals(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

-- Service-role only; no participant RLS policies needed (writes via service client)
ALTER TABLE event_vitals ENABLE ROW LEVEL SECURITY;

-- ─── event_errors ────────────────────────────────────────────────────────────
-- Stores client-side JS errors reported via /api/telemetry/error.
CREATE TABLE IF NOT EXISTS event_errors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        REFERENCES events(id) ON DELETE CASCADE,
  message     text        NOT NULL,
  stack       text,
  url         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_errors_created
  ON event_errors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_errors_event
  ON event_errors(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

ALTER TABLE event_errors ENABLE ROW LEVEL SECURITY;

-- ─── Idempotency for messages ────────────────────────────────────────────────
-- Prevents duplicate messages when the client retries a POST /api/secure/messages
-- after a network failure. NULL keys do not collide (partial unique index).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency
  ON messages(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
