-- Migration 019: Track whether QR page email has been sent per event
-- Adds a simple boolean flag so the admin can see at a glance which
-- events already received their QR page email.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS qr_page_sent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.qr_page_sent IS 'Whether the QR page email (C8) has been sent to the client for this event';
