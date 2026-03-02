-- ============================================
-- Migration 011: Phone Verification & Messaging
-- Adds phone verification, OTP, guest messaging,
-- message logging, client portal tokens, and
-- discount tracking tables.
-- ============================================

-- ── 1. Add phone + consent columns to participants ──
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_sent BOOLEAN NOT NULL DEFAULT false;

-- Phone validation: E.164 format, max 20 chars
ALTER TABLE participants
  ADD CONSTRAINT chk_participants_phone
  CHECK (phone IS NULL OR (char_length(phone) >= 10 AND char_length(phone) <= 20));

-- Unique phone per event (a phone number can exist in multiple events)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_phone_event
  ON participants(event_id, phone)
  WHERE phone IS NOT NULL;

-- ── 2. OTP verification table ──
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL CHECK (char_length(phone) >= 10 AND char_length(phone) <= 20),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (char_length(code) >= 4 AND char_length(code) <= 8),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookup: phone + event_id + not used + not expired
CREATE INDEX IF NOT EXISTS idx_otp_phone_event
  ON otp_verifications(phone, event_id)
  WHERE is_used = false;

-- ── 3. Event-level WhatsApp messaging & guest list config ──
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS wa_messages_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_list_uploaded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_list_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_list_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events
  ADD CONSTRAINT chk_events_guest_list_count
  CHECK (guest_list_count >= 0 AND guest_list_count <= 10000);

-- ── 4. Guest phone list for pre-event messages ──
CREATE TABLE IF NOT EXISTS event_guest_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phone TEXT NOT NULL CHECK (char_length(phone) >= 10 AND char_length(phone) <= 20),
  guest_name TEXT CHECK (guest_name IS NULL OR char_length(guest_name) <= 100),
  wa_pre_event_sent BOOLEAN NOT NULL DEFAULT false,
  wa_pre_event_sent_at TIMESTAMPTZ,
  wa_marketing_window_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_event_guest_phones_event
  ON event_guest_phones(event_id);

CREATE INDEX IF NOT EXISTS idx_event_guest_phones_pending
  ON event_guest_phones(event_id)
  WHERE wa_pre_event_sent = false;

-- ── 5. Message log (for auditing + checking WA windows) ──
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phone TEXT NOT NULL CHECK (char_length(phone) >= 10 AND char_length(phone) <= 20),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  message_type TEXT NOT NULL CHECK (message_type IN ('otp', 'pre_event', 'welcome', 'feedback')),
  wa_category TEXT CHECK (wa_category IS NULL OR wa_category IN ('authentication', 'marketing', 'utility')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'read')),
  provider_message_id TEXT CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 200),
  error_message TEXT CHECK (error_message IS NULL OR char_length(error_message) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_log_event
  ON message_log(event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_message_log_phone
  ON message_log(phone, message_type);

-- ── 6. Client portal tokens (secure links for guest upload) ──
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (char_length(token) >= 4 AND char_length(token) <= 128),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_token_active
  ON client_portal_tokens(token) WHERE is_active = true;

-- ── 7. Discount claims (persists after event deletion) ──
CREATE TABLE IF NOT EXISTS discount_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL CHECK (char_length(phone) >= 10 AND char_length(phone) <= 20),
  discount_code TEXT NOT NULL CHECK (char_length(discount_code) >= 1 AND char_length(discount_code) <= 50),
  event_name TEXT NOT NULL CHECK (char_length(event_name) >= 1 AND char_length(event_name) <= 200),
  event_date DATE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  wa_message_id TEXT CHECK (wa_message_id IS NULL OR char_length(wa_message_id) <= 200),
  is_redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_claims_code
  ON discount_claims(discount_code);

CREATE INDEX IF NOT EXISTS idx_discount_claims_phone
  ON discount_claims(phone);

-- ── 8. RLS for all new tables ──
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_claims ENABLE ROW LEVEL SECURITY;

-- No anon SELECT policies — all access via service_role only.
-- These tables contain sensitive phone numbers and tokens.
