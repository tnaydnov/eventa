-- 039_session_epoch.sql
-- Session revocation support (SECURITY_HARDENING_PLAN §5.2).
--
-- Stateless JWTs cannot be invalidated before they expire. A stolen 30-day
-- session token would otherwise stay valid for its full lifetime. This adds a
-- per-participant `session_epoch` counter that is embedded in each freshly
-- signed token (as the `sep` claim). secureGuard() rejects any token whose
-- `sep` is older than the participant's current epoch, so incrementing the
-- epoch performs an immediate "log out everywhere" / post-ban revocation.
--
-- Backward compatible: tokens signed before this migration carry no `sep`
-- claim and are still accepted (they expire naturally within 30 days). New
-- tokens get the current epoch. Bumping the epoch revokes only tokens issued
-- before the bump.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS session_epoch INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN participants.session_epoch IS
  'Monotonic session-revocation counter. Embedded in session JWTs as the "sep" claim; '
  'incrementing it invalidates all tokens issued before the bump (logout-everywhere / post-ban).';

-- Atomic increment helper so the API can revoke sessions without a read-modify-write
-- race. Called via supabase.rpc(''increment_session_epoch'', { p_participant_id }).
-- service_role bypasses RLS; SECURITY DEFINER keeps behaviour stable regardless of caller role.
CREATE OR REPLACE FUNCTION increment_session_epoch(p_participant_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE participants
  SET session_epoch = session_epoch + 1
  WHERE id = p_participant_id
  RETURNING session_epoch;
$$;
