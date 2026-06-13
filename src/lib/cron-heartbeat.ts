/**
 * Cron reliability tracking (SECURITY_HARDENING_PLAN §12, §14).
 *
 * Vercel Cron is at-least-once and can silently miss runs. Each cron records a
 * heartbeat on every invocation; /api/admin/cron-health reads them to detect a job
 * that has stopped completing within its expected window so an uptime monitor can alert.
 *
 * `withCronHeartbeat` wraps a route handler with zero behaviour change: it times the
 * handler, records success/error/skipped, and returns the original response untouched.
 * Heartbeat writes are awaited (so they persist before the serverless function freezes)
 * but fully guarded and bounded — a heartbeat failure never changes the job's response.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withTimeout } from '@/lib/resilience';

export type CronStatus = 'success' | 'error' | 'skipped';

/**
 * Expected run interval per cron job, in minutes (mirrors the schedules in vercel.json).
 * A job is "stale" when its last success is older than interval × grace.
 */
export const CRON_INTERVAL_MINUTES: Record<string, number> = {
  'auto-archive': 1440,        // daily 03:00
  'cleanup': 1440,             // daily 04:00
  'upload-reminders': 1440,    // daily 07:00
  'pre-event-messages': 60,    // hourly
  'feedback-messages': 60,     // hourly
  'send-reports': 60,          // hourly
  'recheck-moderation': 15,    // every 15 min
  'reconcile-payments': 1440,  // daily 05:00
  'dispatch-sms': 1,           // every minute
};

/** How many missed intervals before a job is considered stale (grace for cron jitter). */
const STALE_GRACE_MULTIPLIER = 3;
/** Floor so a once-a-minute job isn't flagged stale after a single skipped tick. */
const MIN_STALE_AGE_MS = 10 * 60 * 1000;
/** Bound the heartbeat write so a slow DB can't delay the cron response. */
const HEARTBEAT_TIMEOUT_MS = 3_000;

/**
 * Persist a heartbeat for `jobName`. Awaitable, but never throws — a failure here must
 * not affect the cron's own result.
 */
export async function recordCronHeartbeat(
  jobName: string,
  result: { status: CronStatus; durationMs?: number; error?: string },
): Promise<void> {
  try {
    const sb = getServiceClient();
    await withTimeout(
      () => Promise.resolve(
        sb.rpc('record_cron_heartbeat', {
          p_job_name: jobName,
          p_status: result.status,
          p_duration_ms: result.durationMs ?? null,
          p_error: result.error ? result.error.slice(0, 500) : null,
        }),
      ).then(({ error }) => {
        if (error) logger.warn('[CRON_HEARTBEAT] persist failed', { jobName, error: error.message });
      }),
      HEARTBEAT_TIMEOUT_MS,
      'cron-heartbeat',
    );
  } catch (err) {
    logger.warn('[CRON_HEARTBEAT] persist threw', {
      jobName, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Wrap a cron route handler so every invocation records a heartbeat.
 *
 * Status mapping: thrown / 5xx → 'error'; other 4xx → 'skipped' (ran but did no work,
 * e.g. auth/rate-limit); < 400 → 'success'. The original response/throw is preserved.
 */
export function withCronHeartbeat(
  jobName: string,
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    const start = Date.now();
    try {
      const res = await handler(req);
      const status: CronStatus = res.status >= 500 ? 'error' : res.status >= 400 ? 'skipped' : 'success';
      await recordCronHeartbeat(jobName, {
        status,
        durationMs: Date.now() - start,
        error: status === 'error' ? `HTTP ${res.status}` : undefined,
      });
      return res;
    } catch (err) {
      await recordCronHeartbeat(jobName, {
        status: 'error',
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}

export interface CronHealthEntry {
  jobName: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  expectedIntervalMin: number | null;
  stale: boolean;
}

/**
 * Read all heartbeats and compute staleness. A job is stale when its last success is
 * older than its expected interval × grace (floored at MIN_STALE_AGE_MS), or it has a
 * known schedule but no recorded success yet.
 */
export async function getCronHealth(now: number = Date.now()): Promise<{ healthy: boolean; crons: CronHealthEntry[] }> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('cron_heartbeats')
    .select('job_name, last_run_at, last_success_at, last_status, last_error');

  if (error) {
    logger.warn('[CRON_HEALTH] read failed', { error: error.message });
    // Unknown ≠ unhealthy: don't page on our own read failure.
    return { healthy: true, crons: [] };
  }

  const rows = (data ?? []) as Array<{
    job_name: string;
    last_run_at: string | null;
    last_success_at: string | null;
    last_status: string | null;
    last_error: string | null;
  }>;
  const byName = new Map(rows.map((r) => [r.job_name, r]));

  // Evaluate every known scheduled job, even if it has never written a heartbeat.
  const crons: CronHealthEntry[] = Object.keys(CRON_INTERVAL_MINUTES).map((jobName) => {
    const row = byName.get(jobName);
    const intervalMin = CRON_INTERVAL_MINUTES[jobName];
    const maxAgeMs = Math.max(MIN_STALE_AGE_MS, intervalMin * 60 * 1000 * STALE_GRACE_MULTIPLIER);
    const lastSuccessMs = row?.last_success_at ? Date.parse(row.last_success_at) : null;
    const stale = lastSuccessMs === null || now - lastSuccessMs > maxAgeMs;
    return {
      jobName,
      lastRunAt: row?.last_run_at ?? null,
      lastSuccessAt: row?.last_success_at ?? null,
      lastStatus: row?.last_status ?? null,
      lastError: row?.last_error ?? null,
      expectedIntervalMin: intervalMin,
      stale,
    };
  });

  return { healthy: crons.every((c) => !c.stale), crons };
}
