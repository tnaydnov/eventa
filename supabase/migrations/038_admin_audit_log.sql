-- Migration 038: append-only admin_audit_log table
--
-- Persists admin + security-relevant events (login success/failure/lockout,
-- event create/update/delete/archive, ban/unban, join-code rotate, background
-- upload, cron auto-archive, …) to the database instead of only stdout, which
-- Vercel retains for a limited window. This is the forensic/repudiation control
-- from the hardening plan (§9 audit trail table, §15 forensic readiness).
--
-- Writes go through the service_role key from API routes (adminAuditLog). The
-- table is APPEND-ONLY: a row-level trigger blocks UPDATE/DELETE even for
-- service_role (triggers fire regardless of RLS bypass), so history can't be
-- silently rewritten. (TRUNCATE remains available as an explicit break-glass.)

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action      TEXT        NOT NULL,
  ip          TEXT,
  actor       TEXT,                                  -- reserved for future per-admin identity
  details     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on, no policies => anon/auth denied; service_role bypasses RLS for writes/reads.
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Query patterns: recent-first browsing, and filtering by action over time.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action  ON admin_audit_log (action, created_at DESC);

-- Append-only enforcement: reject UPDATE/DELETE on individual rows.
CREATE OR REPLACE FUNCTION prevent_admin_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_no_mutate ON admin_audit_log;
CREATE TRIGGER trg_admin_audit_no_mutate
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();
