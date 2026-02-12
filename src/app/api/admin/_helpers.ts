/**
 * Shared helpers for admin API routes.
 * Eliminates repeated auth/rate-limit/UUID-validation boilerplate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/admin-auth';
import { isValidUUID } from '@/lib/session';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';

export { jsonError };

/**
 * Admin auth guard: rate-limit → admin cookie verification.
 * Returns an error response if either check fails, or null if authorized.
 * Rate-limit runs first (cheap) to avoid crypto work on spam requests.
 */
export function adminGuard(
  req: NextRequest,
  rateLimitKey: string,
  limit: RateLimitConfig
): NextResponse | null {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`${rateLimitKey}:${ip}`, limit);
  if (!rl.allowed) return jsonError('Too many requests', 429);
  if (!verifyAdminFromRequest(req)) return jsonError('Unauthorized', 401);
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
