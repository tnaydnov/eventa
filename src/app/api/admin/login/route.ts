import { NextRequest, NextResponse } from 'next/server';
import { adminLoginSchema } from '@/lib/validations';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { signAdminToken, adminCookieHeader, adminAuditLog } from '@/lib/admin-auth';
import {
  hasAdminCredential,
  verifyAdminPassword,
} from '@/lib/admin-credentials';
import { verifyTotp, isTotpConfigured, getTotpSecret } from '@/lib/totp';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { alertAdminLoginFailures, alertAdminTotpFailures } from '@/lib/security-alert';

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

/** Separate TOTP failure counter — 5 bad TOTP codes in 5 min triggers alert + lockout. */
const totpFailures = new Map<string, { count: number; firstAttempt: number }>();
const TOTP_LOCKOUT_THRESHOLD = 5;
const TOTP_LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

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
  totpFailures.delete(ip);
}

function recordTotpFailure(ip: string): void {
  const entry = totpFailures.get(ip);
  const now = Date.now();
  if (!entry || now - entry.firstAttempt > TOTP_LOCKOUT_WINDOW_MS) {
    totpFailures.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
    // Alert when threshold is crossed
    if (entry.count >= TOTP_LOCKOUT_THRESHOLD) {
      alertAdminTotpFailures(ip, entry.count);
    }
  }
}

function isTotpLockedOut(ip: string): boolean {
  const entry = totpFailures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > TOTP_LOCKOUT_WINDOW_MS) {
    totpFailures.delete(ip);
    return false;
  }
  return entry.count >= TOTP_LOCKOUT_THRESHOLD;
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

    // 1. Verify password (scrypt hash preferred, plaintext fallback - both timing-safe).
    if (!verifyAdminPassword(parsed.data.password)) {
      recordFailedAttempt(ip);
      adminAuditLog('LOGIN_FAILED', { ip }, req);
      // Alert at 3, 5, 10 failures
      const entry = failedAttempts.get(ip);
      if (entry && (entry.count === 3 || entry.count === 5 || entry.count >= 10)) {
        alertAdminLoginFailures(ip, entry.count);
      }
      // Constant generic error - don't reveal if password was close
      return jsonError('Unauthorized', 401);
    }

    // 2. Verify TOTP second factor (if ADMIN_TOTP_SECRET is configured).
    //    If TOTP is configured but no code was provided → inform the client that TOTP is required.
    //    This lets the UI present a TOTP field after password is accepted.
    if (isTotpConfigured()) {
      const totpToken = parsed.data.totp;
      if (!totpToken) {
        // Password correct but TOTP not yet provided — signal to the UI to ask for it.
        // We do NOT increment failed attempts here (password was correct).
        return NextResponse.json({ requireTotp: true }, { status: 200 });
      }
      // Check TOTP lockout (separate from password lockout)
      if (isTotpLockedOut(ip)) {
        adminAuditLog('LOGIN_TOTP_LOCKED_OUT', { ip }, req);
        return NextResponse.json(
          { error: 'Too many TOTP attempts. Try again later.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(TOTP_LOCKOUT_WINDOW_MS / 1000)) } }
        );
      }
      const secret = getTotpSecret()!;
      // Diagnostic: log secret fingerprint and expected codes to help debug mismatches.
      // Only logs non-sensitive info: first/last 2 chars, length, and current valid codes.
      try {
        const { base32Decode: b32, generateTotp } = await import('@/lib/totp');
        b32(secret); // throws if invalid base32
        const now = Date.now();
        const step = 30;
        const codes = [-2,-1,0,1,2].map(i => generateTotp(secret, { t: now + i * step * 1000 }));
        logger.info(`[ADMIN_TOTP_DEBUG] secret_len=${secret.length} secret_fingerprint="${secret.slice(0,2)}...${secret.slice(-2)}" submitted="${totpToken}" valid_window=[${codes.join(',')}]`);
      } catch (diagErr) {
        logger.error(`[ADMIN_TOTP_DEBUG] SECRET IS INVALID BASE32: ${diagErr}`);
      }
      if (!verifyTotp(totpToken, secret, { window: 2 })) {
        recordTotpFailure(ip);
        adminAuditLog('LOGIN_TOTP_FAILED', { ip }, req);
        return jsonError('Invalid TOTP code', 401);
      }
    }

    // All factors verified — clear failed attempts and issue token.
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
