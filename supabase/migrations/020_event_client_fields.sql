-- Migration 020: Add client contact fields directly on events table
-- Previously, contact info only existed on event_requests (for orders via the form).
-- Manually created events had no contact data, breaking email actions.
-- This stores contact info on the event itself so all events can send emails.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';

COMMENT ON COLUMN events.client_name IS 'Client full name for emails and display';
COMMENT ON COLUMN events.client_email IS 'Client email address for sending email communications';
COMMENT ON COLUMN events.client_phone IS 'Client phone number';
COMMENT ON COLUMN events.communication_preference IS 'Preferred contact method: email, phone, whatsapp';

-- Backfill existing events from their linked event_requests
UPDATE events e
SET
  client_name = er.contact_name,
  client_email = er.contact_email,
  client_phone = er.contact_phone,
  communication_preference = er.contact_preference
FROM event_requests er
WHERE er.approved_event_id = e.id
  AND e.client_email IS NULL;
