-- Migration: 025_sms_notifications.sql
-- Tables and columns for SMS notification dispatch system.

-- ─── pending_sms ─────────────────────────────────────────────
-- Queue of SMS messages to be sent by the cron dispatcher.
CREATE TABLE IF NOT EXISTS pending_sms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  phone           TEXT NOT NULL,
  message_type    TEXT NOT NULL CHECK (message_type IN (
    'like', 'match', 'message', 'abandoned_funnel', 'inactivity'
  )),
  body            TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_sms_ready
  ON pending_sms(scheduled_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_sms_recipient
  ON pending_sms(recipient_id, event_id, message_type)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

-- ─── sms_quotas ─────────────────────────────────────────────
-- Per-participant throttle tracking to prevent SMS flooding.
CREATE TABLE IF NOT EXISTS sms_quotas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  message_type    TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, participant_id, message_type, sent_at)
);

CREATE INDEX IF NOT EXISTS idx_sms_quotas_lookup
  ON sms_quotas(participant_id, event_id, message_type, sent_at DESC);

-- ─── sms_optout ─────────────────────────────────────────────
-- Hard opt-out list (overrides sms_consent).
CREATE TABLE IF NOT EXISTS sms_optout (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL UNIQUE,
  opted_out_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── participants: new columns ───────────────────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tab_visible               BOOLEAN NOT NULL DEFAULT false;

-- ─── events: new column ─────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- RLS
ALTER TABLE pending_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_optout ENABLE ROW LEVEL SECURITY;
-- Service role bypass applies; no client-side access
