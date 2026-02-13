-- Migration 005: Make last_message_at nullable so empty conversations
-- don't appear in the other user's chat list.
--
-- Previously, last_message_at defaulted to now() on conversation creation,
-- making empty conversations indistinguishable from active ones.
-- With NULL default, conversations without messages can be filtered out.

ALTER TABLE conversations ALTER COLUMN last_message_at DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN last_message_at SET DEFAULT NULL;

-- Set existing empty conversations to NULL
UPDATE conversations
SET last_message_at = NULL
WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages);
