-- Migration: 034_pending_sms_attempts.sql
-- Adds retry attempt tracking to pending_sms queue.

ALTER TABLE pending_sms
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pending_sms_attempts
  ON pending_sms(attempts)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;
