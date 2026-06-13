import { NextRequest, NextResponse } from 'next/server';
import { adminLoginSchema } from '@/lib/validations';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { signAdminToken, adminCookieHeader, adminAuditLog } from '@/lib/admin-auth';
import {
  hasAdminCredential,
  verifyAdminPassword,
  isAdminTotpEnabled,
  verifyAdminTotp,
} from '@/lib/admin-credentials';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * Brute-force lockout: after 10 failed attempts in 15 minutes,
 * lock out the IP for the remaining window.
 *
 * Safety cap: if map exceeds MAX_ENTRIES, purge all stale entries immediately.
 * This prevents unbounded memory growth under distributed brute-force attacks.
 */
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 10_000;
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 600_000; // 10 minutes

/** Purge stale entries from the failedAttempts map. */
function purgeStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of failedAttempts.entries()) {
    if (now - entry.firstAttempt > LOCKOUT_WINDOW_MS) failedAttempts.delete(key);
  }
  lastCleanup = now;
}

/** Lazy cleanup: purge if enough time has passed or map is too large. */
function maybeCleanup(): void {
  if (failedAttempts.size > MAX_ENTRIES || Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
    purgeStaleEntries();
  }
}

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

export async function POST(req: NextRequest) {
  // Lazy cleanup of stale lockout entries (replaces module-scope setInterval)
  maybeCleanup();

  // Rate limit: 5 attempts per minute
  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`admin-login:${ip}`, RATE_LIMITS.auth);
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

    // Fail closed if no admin credential is configured at all.
    if (!hasAdminCredential()) {
      logger.error('No admin credential configured (set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD)');
      return jsonError('Server configuration error', 500);
    }

    // 1. Verify password (scrypt hash preferred, plaintext fallback — both timing-safe).
    if (!verifyAdminPassword(parsed.data.password)) {
      recordFailedAttempt(ip);
      adminAuditLog('LOGIN_FAILED', { ip }, req);
      // Constant generic error - don't reveal if password was close
      return jsonError('Unauthorized', 401);
    }

    // 2. Optional second factor — only enforced when ADMIN_TOTP_SECRET is set.
    if (isAdminTotpEnabled()) {
      const totp = parsed.data.totp;
      if (!totp) {
        // Password is correct but a 2FA code is still required. This is the normal
        // two-step flow, not an attack signal, so we don't count it as a failed attempt.
        adminAuditLog('LOGIN_TOTP_REQUIRED', { ip }, req);
        return NextResponse.json(
          { error: 'נדרש קוד אימות דו-שלבי', totpRequired: true },
          { status: 401 },
        );
      }
      if (!verifyAdminTotp(totp)) {
        recordFailedAttempt(ip);
        adminAuditLog('LOGIN_FAILED', { ip, reason: 'totp' }, req);
        return jsonError('Unauthorized', 401);
      }
    }

    // Success - clear failed attempts and issue token
    clearFailedAttempts(ip);
    const token = signAdminToken();
    const res = NextResponse.json({ success: true });
    res.headers.set('Set-Cookie', adminCookieHeader(token));
    adminAuditLog('LOGIN_SUCCESS', { ip }, req);
    return res;
  } catch (err) {
    logger.error('[ADMIN_LOGIN] error:', err);
    return jsonError('Bad request', 400);
  }
}
