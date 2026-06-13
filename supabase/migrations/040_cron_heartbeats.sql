-- 040_cron_heartbeats.sql
-- Cron reliability tracking (SECURITY_HARDENING_PLAN §12, §14).
--
-- Vercel Cron has at-least-once semantics and can silently miss runs. Without a
-- record of "last successful run" per job there is no way to detect a cron that
-- has stopped firing. This table is written by each cron via record_cron_heartbeat()
-- and read by /api/admin/cron-health to surface stale jobs to an uptime monitor.

CREATE TABLE IF NOT EXISTS cron_heartbeats (
  job_name         TEXT PRIMARY KEY,
  last_run_at      TIMESTAMPTZ,        -- last time the endpoint was invoked (any outcome)
  last_success_at  TIMESTAMPTZ,        -- last time it completed successfully (staleness is measured from here)
  last_status      TEXT,               -- 'success' | 'error' | 'skipped'
  last_error       TEXT,               -- truncated error message from the most recent failure
  last_duration_ms INTEGER,
  run_count        BIGINT NOT NULL DEFAULT 0,
  fail_count       BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on, no policies → only service_role (used by API routes) can read/write.
ALTER TABLE cron_heartbeats ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cron_heartbeats IS
  'Per-cron "last successful run" tracking for missed-run detection (see /api/admin/cron-health).';

-- Atomic upsert + counter increment so concurrent invocations never race.
-- Called via supabase.rpc(''record_cron_heartbeat'', { p_job_name, p_status, p_duration_ms, p_error }).
CREATE OR REPLACE FUNCTION record_cron_heartbeat(
  p_job_name    text,
  p_status      text,
  p_duration_ms integer DEFAULT NULL,
  p_error       text    DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO cron_heartbeats AS h (
    job_name, last_run_at, last_success_at, last_status, last_error,
    last_duration_ms, run_count, fail_count, updated_at
  )
  VALUES (
    p_job_name, now(),
    CASE WHEN p_status = 'success' THEN now() ELSE NULL END,
    p_status, p_error, p_duration_ms,
    1,
    CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (job_name) DO UPDATE SET
    last_run_at      = now(),
    last_success_at  = CASE WHEN p_status = 'success' THEN now() ELSE h.last_success_at END,
    last_status      = p_status,
    last_error       = CASE WHEN p_status = 'error' THEN p_error ELSE h.last_error END,
    last_duration_ms = COALESCE(p_duration_ms, h.last_duration_ms),
    run_count        = h.run_count + 1,
    fail_count       = h.fail_count + CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    updated_at       = now();
$$;
