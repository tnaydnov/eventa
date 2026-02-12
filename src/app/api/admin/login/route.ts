import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminLoginSchema } from '@/lib/validations';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { signAdminToken, adminCookieHeader, adminAuditLog } from '@/lib/admin-auth';
import { jsonError } from '@/lib/route-helpers';

/**
 * Brute-force lockout: after 10 failed attempts in 15 minutes,
 * lock out the IP for the remaining window.
 */
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isLockedOut(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > LOCKOUT_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOCKOUT_THRESHOLD;
}

function recordFailedAttempt(ip: string): void {
  const entry = failedAttempts.get(ip);
  const now = Date.now();
  if (!entry || now - entry.firstAttempt > LOCKOUT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

// Cleanup stale entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of failedAttempts.entries()) {
      if (now - entry.firstAttempt > LOCKOUT_WINDOW_MS) failedAttempts.delete(key);
    }
  }, 600_000);
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per minute
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`admin-login:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts, try again later' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  // Brute-force lockout check
  if (isLockedOut(ip)) {
    adminAuditLog('LOGIN_LOCKED_OUT', { ip }, req);
    return NextResponse.json(
      { error: 'Account locked. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(LOCKOUT_WINDOW_MS / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Invalid request', 400);
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable is not set');
      return jsonError('Server configuration error', 500);
    }

    // Timing-safe comparison: hash both to SHA-256 (fixed 32 bytes) before comparing.
    // Comparing raw buffers would leak password length via the length check.
    const inputHash = crypto.createHash('sha256').update(parsed.data.password).digest();
    const secretHash = crypto.createHash('sha256').update(adminPassword).digest();
    if (!crypto.timingSafeEqual(inputHash, secretHash)) {
      recordFailedAttempt(ip);
      adminAuditLog('LOGIN_FAILED', { ip }, req);
      // Constant generic error — don't reveal if password was close
      return jsonError('Unauthorized', 401);
    }

    // Success — clear failed attempts and issue token
    clearFailedAttempts(ip);
    const token = signAdminToken();
    const res = NextResponse.json({ success: true });
    res.headers.set('Set-Cookie', adminCookieHeader(token));
    adminAuditLog('LOGIN_SUCCESS', { ip }, req);
    return res;
  } catch (err) {
    console.error('[ADMIN_LOGIN] error:', err);
    return jsonError('Bad request', 400);
  }
}
