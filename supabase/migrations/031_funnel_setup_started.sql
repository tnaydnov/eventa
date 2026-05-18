-- Migration: 031_funnel_setup_started.sql
-- Expands funnel step constraint to include setup_started.

ALTER TABLE funnel_events
DROP CONSTRAINT IF EXISTS funnel_events_step_check;

ALTER TABLE funnel_events
ADD CONSTRAINT funnel_events_step_check
CHECK (step IN (
  'qr_scan', 'join_page_view', 'otp_requested', 'otp_verified',
  'setup_started', 'profile_complete', 'like_sent', 'match_created', 'message_sent', 'conversation_opened'
));
