-- ============================================================================
-- Migration 046: PII Field Encryption (dual-column rollout)
--
-- Adds `_enc` (AES-256-GCM ciphertext) and `_bi` (HMAC blind-index) sibling
-- columns for every column that holds personal/special-category data.
--
-- Strategy (zero-downtime):
--   1. Add new columns (nullable, no constraints).
--   2. App is updated to dual-write: old column (plaintext) + new columns.
--   3. Run the backfill Node.js script to populate _enc/_bi from existing data.
--   4. After verifying, reads switch to prefer _enc; lookups use _bi.
--   5. OLD plaintext columns can be dropped in a future migration once verified.
--
-- Run in Supabase SQL Editor.
-- ============================================================================

-- ─── participants ────────────────────────────────────────────────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS phone_enc         TEXT,
  ADD COLUMN IF NOT EXISTS phone_bi          TEXT,
  ADD COLUMN IF NOT EXISTS attracted_to_enc  TEXT,
  ADD COLUMN IF NOT EXISTS looking_for_enc   TEXT,
  ADD COLUMN IF NOT EXISTS bio_enc           TEXT;

-- Blind index is the lookup column for phone — must support fast equality scan
CREATE INDEX IF NOT EXISTS idx_participants_phone_bi
  ON participants(event_id, phone_bi)
  WHERE phone_bi IS NOT NULL;

-- ─── otp_verifications ───────────────────────────────────────────────────────
ALTER TABLE otp_verifications
  ADD COLUMN IF NOT EXISTS phone_enc TEXT,
  ADD COLUMN IF NOT EXISTS phone_bi  TEXT;

CREATE INDEX IF NOT EXISTS idx_otp_phone_bi
  ON otp_verifications(phone_bi, event_id)
  WHERE phone_bi IS NOT NULL;

-- ─── events ──────────────────────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS client_name_enc   TEXT,
  ADD COLUMN IF NOT EXISTS client_email_enc  TEXT,
  ADD COLUMN IF NOT EXISTS client_email_bi   TEXT,
  ADD COLUMN IF NOT EXISTS client_phone_enc  TEXT,
  ADD COLUMN IF NOT EXISTS client_phone_bi   TEXT;

CREATE INDEX IF NOT EXISTS idx_events_client_email_bi
  ON events(client_email_bi)
  WHERE client_email_bi IS NOT NULL;

-- ─── event_requests ──────────────────────────────────────────────────────────
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS contact_name_enc   TEXT,
  ADD COLUMN IF NOT EXISTS contact_email_enc  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email_bi   TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone_enc  TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone_bi   TEXT;

CREATE INDEX IF NOT EXISTS idx_event_requests_contact_email_bi
  ON event_requests(contact_email_bi)
  WHERE contact_email_bi IS NOT NULL;

-- ─── event_guest_phones ───────────────────────────────────────────────────────
ALTER TABLE event_guest_phones
  ADD COLUMN IF NOT EXISTS phone_enc      TEXT,
  ADD COLUMN IF NOT EXISTS phone_bi       TEXT,
  ADD COLUMN IF NOT EXISTS guest_name_enc TEXT;

CREATE INDEX IF NOT EXISTS idx_guest_phones_phone_bi
  ON event_guest_phones(event_id, phone_bi)
  WHERE phone_bi IS NOT NULL;

-- ─── message_log ─────────────────────────────────────────────────────────────
ALTER TABLE message_log
  ADD COLUMN IF NOT EXISTS phone_enc TEXT,
  ADD COLUMN IF NOT EXISTS phone_bi  TEXT;

CREATE INDEX IF NOT EXISTS idx_message_log_phone_bi
  ON message_log(phone_bi)
  WHERE phone_bi IS NOT NULL;

-- ─── discount_claims ─────────────────────────────────────────────────────────
ALTER TABLE discount_claims
  ADD COLUMN IF NOT EXISTS phone_enc TEXT,
  ADD COLUMN IF NOT EXISTS phone_bi  TEXT;

CREATE INDEX IF NOT EXISTS idx_discount_claims_phone_bi
  ON discount_claims(phone_bi)
  WHERE phone_bi IS NOT NULL;
