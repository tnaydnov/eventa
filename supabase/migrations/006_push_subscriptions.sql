-- ============================================
-- 006: Push Subscriptions table
-- Stores Web Push API subscriptions per participant
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, endpoint)
);

-- Fast lookup when sending push to a participant
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_participant
  ON push_subscriptions (participant_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Participants can manage their own subscriptions
CREATE POLICY push_sub_own ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);
