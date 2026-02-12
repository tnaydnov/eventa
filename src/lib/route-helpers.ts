/**
 * Shared helpers for API route handlers.
 * Eliminates repeated guard boilerplate across secure routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, checkCsrf, type SessionPayload } from '@/lib/session';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';

/** Shorthand for JSON error response. */
export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Secure-route guard: CSRF → session → rate-limit.
 * Returns the authenticated session on success, or
 * a NextResponse error that should be returned immediately.
 *
 * Usage:
 * ```ts
 * const guard = secureGuard(req, 'my-route', RATE_LIMITS.standard);
 * if (guard instanceof NextResponse) return guard;
 * const session = guard; // SessionPayload
 * ```
 */
export function secureGuard(
  req: NextRequest,
  rateLimitKey: string,
  limit: RateLimitConfig
): NextResponse | SessionPayload {
  if (!checkCsrf(req)) return jsonError('Forbidden', 403);

  const session = getSessionFromRequest(req);
  if (!session) return jsonError('Unauthorized', 401);

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`${rateLimitKey}:${ip}`, limit);
  if (!rl.allowed) return jsonError('Too many requests', 429);

  return session;
}

/** Reject path traversal and dangerous characters in storage paths. */
export function isSafePath(p: string): boolean {
  // Decode URL-encoded characters before checking traversal patterns
  let decoded: string;
  try {
    decoded = decodeURIComponent(p);
  } catch {
    return false; // Malformed encoding
  }
  // Reject traversal, absolute paths, and dangerous characters
  if (decoded.includes('..') || decoded.includes('//') || decoded.includes('\\') || decoded.includes('\0')) return false;
  // Reject absolute paths (Unix or Windows drive letters)
  if (decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) return false;
  return true;
}
