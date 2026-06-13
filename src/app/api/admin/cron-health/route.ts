import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth, jsonError } from '@/lib/route-helpers';
import { verifyAdminFromRequest } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getCronHealth } from '@/lib/cron-heartbeat';

/**
 * GET /api/admin/cron-health
 *
 * Reports per-cron "last successful run" freshness so an external uptime monitor can
 * alert when a scheduled job stops firing (SECURITY_HARDENING_PLAN §12/§14).
 *
 * Returns 200 when every cron is fresh, 503 when any is stale — so a monitor that
 * alerts on non-2xx works out of the box.
 *
 * Auth: either a `Bearer CRON_SECRET` header (for the monitor) or a valid admin cookie
 * (for the admin UI). Rate-limited to prevent probing.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-health:${ip}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) return jsonError('Too many requests', 429);

  if (!verifyCronAuth(req) && !verifyAdminFromRequest(req)) {
    return jsonError('Unauthorized', 401);
  }

  const { healthy, crons } = await getCronHealth();
  return NextResponse.json(
    { healthy, crons, checkedAt: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
