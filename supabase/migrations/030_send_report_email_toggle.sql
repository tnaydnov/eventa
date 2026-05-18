-- Migration: 030_send_report_email_toggle.sql
-- Adds per-event toggle for post-event report email delivery.

ALTER TABLE events
ADD COLUMN IF NOT EXISTS send_report_email BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN events.send_report_email IS 'If false, send-reports cron skips email delivery for this event.';
