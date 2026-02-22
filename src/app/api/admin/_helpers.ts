/**
 * Shared helpers for admin API routes.
 * Eliminates repeated auth/rate-limit/UUID-validation boilerplate.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAdminFromRequest } from '@/lib/admin-auth';
import { isValidUUID, checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

export { jsonError };

/** Default max body size for admin routes (512 KB). */
const ADMIN_MAX_BODY_BYTES = 512 * 1024;

/**
 * Verify CRON_SECRET from Authorization header (for Vercel Cron).
 */
function hasCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const expected = `Bearer ${cronSecret}`;
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(authHash, expectedHash);
}

/**
 * Admin auth guard: body size → rate-limit → admin cookie OR cron secret.
 * Returns an error response if any check fails, or null if authorized.
 * Rate-limit runs first (cheap) to avoid crypto work on spam requests.
 */
export function adminGuard(
  req: NextRequest,
  rateLimitKey: string,
  limit: RateLimitConfig,
  options?: { maxBodyBytes?: number }
): NextResponse | null {
  // Body size guard - reject oversized payloads early
  const maxBody = options?.maxBodyBytes ?? ADMIN_MAX_BODY_BYTES;
  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > maxBody) {
    return jsonError('Payload too large', 413);
  }

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`${rateLimitKey}:${ip}`, limit);
  if (!rl.allowed) return jsonError('Too many requests', 429);

  // Accept either admin cookie auth or cron secret auth
  const isCookieAuth = verifyAdminFromRequest(req);
  const isCronAuth = hasCronAuth(req);
  if (!isCookieAuth && !isCronAuth) {
    const hasCookie = !!req.cookies.get('ws_admin')?.value;
    logger.warn('[ADMIN_GUARD] 401', { route: rateLimitKey, hasCookie, ip });
    return jsonError('Unauthorized', 401);
  }
  // CSRF defense-in-depth for browser (cookie) requests on mutating methods
  if (isCookieAuth && !checkCsrf(req)) {
    logger.warn('[ADMIN_GUARD] CSRF check failed', { route: rateLimitKey, ip });
    return jsonError('Forbidden', 403);
  }
  return null;
}

/**
 * Validate an eventId path parameter (UUID v4 format).
 * Returns an error response if invalid, or null if valid.
 */
export function validateEventId(eventId: string): NextResponse | null {
  if (!isValidUUID(eventId)) return jsonError('Invalid event ID', 400);
  return null;
}
