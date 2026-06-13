-- ============================================================================
-- Migration 047: Drop plaintext PII columns (final cutover)
--
-- All application code now reads exclusively from `_enc` / `_bi` columns.
-- The backfill script (scripts/backfill-pii.cjs) has already populated those
-- columns for every existing row. This migration removes the old plaintext
-- columns permanently.
--
-- Prerequisites (MUST be completed before running this migration):
--   1. Migration 046 applied (added _enc / _bi sibling columns).
--   2. backfill-pii.cjs executed — verify _enc columns are populated.
--   3. New app code deployed (stops writing to the plaintext columns).
--
-- KEPT AS PLAINTEXT (by design):
--   participants.attracted_to  — 3-value ENUM used by matching algorithm; not
--                                directly identifying.
--   participants.gender        — Non-PII demographic field.
--
-- Run in Supabase SQL Editor.
-- ============================================================================

-- ─── participants ────────────────────────────────────────────────────────────
-- Drop the unique index on (event_id, phone) first (plain phone lookup replaced
-- by blind-index index idx_participants_phone_bi added in migration 046).
DROP INDEX IF EXISTS idx_participants_phone_event;

ALTER TABLE participants
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS looking_for;

-- ─── otp_verifications ───────────────────────────────────────────────────────
-- Drop old plain-phone lookup index first.
DROP INDEX IF EXISTS idx_otp_phone_event;

ALTER TABLE otp_verifications
  DROP COLUMN IF EXISTS phone;

-- ─── events ──────────────────────────────────────────────────────────────────
ALTER TABLE events
  DROP COLUMN IF EXISTS client_name,
  DROP COLUMN IF EXISTS client_email,
  DROP COLUMN IF EXISTS client_phone;

-- ─── event_requests ──────────────────────────────────────────────────────────
ALTER TABLE event_requests
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_phone;

-- ─── event_guest_phones ───────────────────────────────────────────────────────
ALTER TABLE event_guest_phones
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS guest_name;

-- ─── message_log ─────────────────────────────────────────────────────────────
ALTER TABLE message_log
  DROP COLUMN IF EXISTS phone;

-- ─── discount_claims ─────────────────────────────────────────────────────────
ALTER TABLE discount_claims
  DROP COLUMN IF EXISTS phone;
