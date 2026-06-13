-- Migration: 044_order_business_terms_consent.sql
-- Records which version of the business/order terms the paying customer accepted,
-- and when they accepted it, on the event_requests table.

ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS business_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS business_terms_accepted_at TIMESTAMPTZ;
