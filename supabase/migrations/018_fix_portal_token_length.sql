-- Migration 018: Fix portal token length constraint
-- The original migration 011 required 32-128 chars for portal tokens,
-- but the application generates 6-char short codes since the join code
-- shortening change. This migration relaxes the constraint to allow
-- tokens as short as 4 characters.

-- Drop existing CHECK constraint on token length
ALTER TABLE client_portal_tokens
  DROP CONSTRAINT IF EXISTS client_portal_tokens_token_check;

-- Add new constraint allowing short tokens (4-128 chars)
ALTER TABLE client_portal_tokens
  ADD CONSTRAINT client_portal_tokens_token_check
  CHECK (char_length(token) >= 4 AND char_length(token) <= 128);
