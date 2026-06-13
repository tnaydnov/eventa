import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { adminAuditLog } from '@/lib/admin-auth';
import { withCronHeartbeat } from '@/lib/cron-heartbeat';
import { callExternal } from '@/lib/resilience';
import { getClearingLogById, isConfigured } from '@/lib/invoice4u';

/**
 * GET|POST /api/cron/reconcile-payments  (SECURITY_HARDENING_PLAN §18)
 *
 * Read-only reconciliation: compares each recent order's local payment_status against
 * the provider's (Invoice4U) clearing-log record and records any divergence to the
 * immutable admin_audit_log for human review. It deliberately does NOT mutate payment
 * state — automatically "fixing" money records is risky; surfacing anomalies is the goal.
 *
 * Detects two anomaly classes:
 *   - provider_success_local_unpaid : provider cleared but we never marked it paid (missed webhook)
 *   - local_paid_provider_failed    : we show paid but the provider has no success (possible spoof)
 *
 * Auth: Bearer CRON_SECRET (timing-safe). Schedule: daily via vercel.json.
 * Time-boxed and batch-capped to stay within the serverless budget; daily runs chip through.
 */

const LOOKBACK_DAYS = 14;
const MAX_CANDIDATES = 60;
const TIME_BUDGET_MS = 12_000; // stop before the 15 s function limit
const PAID_STATUSES = new Set(['paid', 'card_captured']);

async function handler(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-reconcile-payments:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) return jsonError('Too many requests', 429);

  // Auth: timing-safe Bearer CRON_SECRET
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[RECONCILE_PAYMENTS] CRON_SECRET not set');
    return jsonError('Server configuration error', 500);
  }
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  if (!isConfigured()) {
    logger.info('[RECONCILE_PAYMENTS] Invoice4U not configured - skipping');
    return NextResponse.json({ skipped: true, reason: 'provider_not_configured' });
  }

  const supabase = getServiceClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Candidates: recent orders that have a provider clearing-log reference.
  const { data: rows, error } = await supabase
    .from('event_requests')
    .select('id, payment_status, clearing_log_id, created_at')
    .not('clearing_log_id', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_CANDIDATES);

  if (error) {
    logger.error('[RECONCILE_PAYMENTS] candidate query failed', { error: error.message });
    return jsonError('Server error', 500);
  }

  const candidates = (rows ?? []) as Array<{
    id: string; payment_status: string | null; clearing_log_id: string | null;
  }>;

  const start = Date.now();
  let checked = 0;
  let mismatches = 0;

  for (const row of candidates) {
    if (Date.now() - start > TIME_BUDGET_MS) {
      logger.info('[RECONCILE_PAYMENTS] time budget reached, deferring rest', { checkedSoFar: checked });
      break;
    }
    if (!row.clearing_log_id) continue;

    let providerSuccess: boolean | null = null;
    try {
      // Bounded + breaker-guarded provider call so a slow Invoice4U can't blow the budget.
      const result = await callExternal(
        'invoice4u',
        () => getClearingLogById(row.clearing_log_id as string),
        { timeoutMs: 4_000, retries: 1, breaker: { failureThreshold: 4, cooldownMs: 30_000 } },
      );
      if (result.success && result.data) providerSuccess = result.data.isSuccess;
    } catch (err) {
      logger.warn('[RECONCILE_PAYMENTS] provider lookup failed', {
        requestId: row.id, error: err instanceof Error ? err.message : String(err),
      });
      continue; // can't reconcile this one now; try next run
    }
    if (providerSuccess === null) continue;

    checked++;
    const localPaid = PAID_STATUSES.has(row.payment_status ?? '');

    if (providerSuccess && !localPaid) {
      mismatches++;
      adminAuditLog('PAYMENT_RECONCILE_MISMATCH', {
        requestId: row.id,
        type: 'provider_success_local_unpaid',
        localStatus: row.payment_status,
        clearingLogId: row.clearing_log_id,
      });
    } else if (!providerSuccess && localPaid) {
      mismatches++;
      adminAuditLog('PAYMENT_RECONCILE_MISMATCH', {
        requestId: row.id,
        type: 'local_paid_provider_failed',
        localStatus: row.payment_status,
        clearingLogId: row.clearing_log_id,
      });
    }
  }

  logger.info('[RECONCILE_PAYMENTS] done', { candidates: candidates.length, checked, mismatches });
  return NextResponse.json({ candidates: candidates.length, checked, mismatches });
}

const cronHandler = withCronHeartbeat('reconcile-payments', handler);
export { cronHandler as GET, cronHandler as POST };
