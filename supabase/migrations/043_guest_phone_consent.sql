-- Migration: 043_guest_phone_consent.sql
-- Records the paying customer's authorization to provide guest phone numbers.
--
-- Before a customer can upload or add guest phone numbers in the guest-list
-- portal, they must confirm they are authorized to share those numbers for
-- event service messages. We store the timestamp + the consent text version
-- on the event as durable evidence.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guest_phone_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_phone_consent_version TEXT;
