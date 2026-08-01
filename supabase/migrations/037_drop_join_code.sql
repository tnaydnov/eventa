-- Migration 037: Drop join_code column from events table
-- join_code is no longer used: access is via slug URL + OTP verification only.

ALTER TABLE events DROP COLUMN IF EXISTS join_code;
