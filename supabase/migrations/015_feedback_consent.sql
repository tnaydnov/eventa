-- Migration 015: Add feedback_consent column to participants
-- Allows participants to explicitly opt-in to receiving feedback
-- messages (questionnaire + discount) the day after the event.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS feedback_consent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN participants.feedback_consent
  IS 'Whether the participant consented to receive feedback/survey messages after the event';
