-- Migration 036: Add payment_link_token and payment_link_expires_at to events table
-- This allows admin-created events (with no event_requests row) to have payment links
-- without polluting event_requests with fake rows.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_link_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_payment_link_token ON events (payment_link_token)
  WHERE payment_link_token IS NOT NULL;
