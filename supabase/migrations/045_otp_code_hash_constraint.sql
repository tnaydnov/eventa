-- Migration 045: widen otp_verifications.code to allow SHA-256 hex hashes
--
-- Context: OTP codes are now stored as SHA-256+pepper hex digests (64 chars)
-- instead of the raw 4-8 digit codes. The original check constraint
-- (char_length(code) >= 4 AND char_length(code) <= 8) was rejecting inserts.
--
-- New constraint: allow 4-64 chars to support both legacy plain codes (if any
-- survive) and the new 64-char hex hashes.

ALTER TABLE otp_verifications
  DROP CONSTRAINT IF EXISTS otp_verifications_code_check;

ALTER TABLE otp_verifications
  ADD CONSTRAINT otp_verifications_code_check
  CHECK (char_length(code) >= 4 AND char_length(code) <= 64);
