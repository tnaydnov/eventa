-- Migration: 024_funnel_events.sql
-- Creates the funnel_events table for tracking user journey analytics.

CREATE TABLE IF NOT EXISTS funnel_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id   TEXT,
  step         TEXT NOT NULL CHECK (step IN (
    'qr_scan', 'join_page_view', 'otp_requested', 'otp_verified',
    'profile_complete', 'like_sent', 'match_created', 'message_sent', 'conversation_opened'
  )),
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for per-event queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_id ON funnel_events(event_id, created_at DESC);

-- Index for session-based funnel queries
CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id, event_id) WHERE session_id IS NOT NULL;

-- RLS: allow insert from service role only (no client-side writes)
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass (default behaviour) — no need for explicit policies
-- Reads are restricted to admin-only via service role key
