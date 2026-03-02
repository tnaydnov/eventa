-- ============================================
-- Migration 012: Expand message_log for email channel
-- Adds 'email' channel + upload reminder message types
-- so the upload-reminders cron can track sent emails.
-- ============================================

-- Drop existing check constraints and re-create with expanded values
ALTER TABLE message_log
  DROP CONSTRAINT IF EXISTS message_log_channel_check;

ALTER TABLE message_log
  ADD CONSTRAINT message_log_channel_check
  CHECK (channel IN ('sms', 'whatsapp', 'email'));

ALTER TABLE message_log
  DROP CONSTRAINT IF EXISTS message_log_message_type_check;

ALTER TABLE message_log
  ADD CONSTRAINT message_log_message_type_check
  CHECK (message_type IN (
    'otp', 'pre_event', 'welcome', 'feedback',
    'upload_reminder_7d', 'upload_reminder_3d',
    'upload_instructions', 'event_summary',
    'addon_invoice', 'custom_reminder'
  ));

-- Make phone nullable for email-only messages (no phone number involved)
ALTER TABLE message_log
  ALTER COLUMN phone DROP NOT NULL;

-- Allow phone to be empty string or NULL for email messages
ALTER TABLE message_log
  DROP CONSTRAINT IF EXISTS message_log_phone_check;

ALTER TABLE message_log
  ADD CONSTRAINT message_log_phone_check
  CHECK (phone IS NULL OR (char_length(phone) >= 1 AND char_length(phone) <= 254));

-- Add optional recipient_email column for email messages
ALTER TABLE message_log
  ADD COLUMN IF NOT EXISTS recipient_email TEXT
  CHECK (recipient_email IS NULL OR char_length(recipient_email) <= 254);
