/**
 * Admin credential verification — password (scrypt-hashed or plaintext) + optional TOTP 2FA.
 *
 * Kept separate from `admin-auth.ts` (which owns the session JWT/cookie) so the
 * "what proves you're the admin" logic has one home and is independently testable.
 *
 * Credential precedence:
 *   1. `ADMIN_PASSWORD_HASH` — a scrypt hash (preferred; nothing reversible at rest).
 *   2. `ADMIN_PASSWORD`      — plaintext env (legacy fallback, still timing-safe compared).
 *
 * Optional second factor:
 *   - `ADMIN_TOTP_SECRET` — when set, a valid TOTP code is also required at login.
 *     When unset, behaviour is unchanged (password only). Fully opt-in.
 *
 * Operator setup (run locally, paste output into env — never commit secrets):
 *   Password hash:
 *     node -e "const c=require('crypto');const p=process.argv[1];const s=c.randomBytes(16);const h=c.scryptSync(p,s,32,{N:16384,r:8,p:1});console.log(`scrypt$16384$8$1$${s.toString('base64')}$${h.toString('base64')}`)" 'YOUR_PASSWORD'
 *   TOTP secret (Base32, add to an authenticator app):
 *     node -e "const c=require('crypto');const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let o='';for(const b of c.randomBytes(20))o+=A[b%32];console.log(o)"
 */
import crypto from 'crypto';
import { verifyTotp } from '@/lib/totp';

/** True if any admin password credential is configured. */
export function hasAdminCredential(): boolean {
  return !!(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD);
}

interface ScryptParams {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/** Parse a stored hash of the form `scrypt$N$r$p$saltBase64$hashBase64`. */
function parseScryptHash(stored: string): ScryptParams | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N <= 0 || r <= 0 || p <= 0) {
    return null;
  }
  try {
    const salt = Buffer.from(parts[4], 'base64');
    const hash = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || hash.length === 0) return null;
    return { N, r, p, salt, hash };
  } catch {
    return null;
  }
}

/** Verify an input password against a scrypt hash string (timing-safe). */
function verifyScrypt(input: string, stored: string): boolean {
  const parsed = parseScryptHash(stored);
  if (!parsed) return false;
  const { N, r, p, salt, hash } = parsed;
  let derived: Buffer;
  try {
    // maxmem raised so larger N/r values don't throw the default 32 MB cap.
    derived = crypto.scryptSync(input, salt, hash.length, { N, r, p, maxmem: 256 * 1024 * 1024 });
  } catch {
    return false;
  }
  return derived.length === hash.length && crypto.timingSafeEqual(derived, hash);
}

/**
 * Verify the admin password against the configured credential.
 * Prefers `ADMIN_PASSWORD_HASH` (scrypt); falls back to plaintext `ADMIN_PASSWORD`.
 */
export function verifyAdminPassword(input: string): boolean {
  if (typeof input !== 'string' || input.length === 0) return false;

  const hashed = process.env.ADMIN_PASSWORD_HASH;
  if (hashed) return verifyScrypt(input, hashed);

  const plain = process.env.ADMIN_PASSWORD;
  if (plain) {
    // SHA-256 both sides to a fixed 32 bytes before timing-safe compare,
    // so the comparison never leaks the password length.
    const a = crypto.createHash('sha256').update(input).digest();
    const b = crypto.createHash('sha256').update(plain).digest();
    return crypto.timingSafeEqual(a, b);
  }
  return false;
}

/** True when admin TOTP 2FA is configured (and therefore required at login). */
export function isAdminTotpEnabled(): boolean {
  return !!process.env.ADMIN_TOTP_SECRET;
}

/** Verify a TOTP code against `ADMIN_TOTP_SECRET`. Returns false if 2FA isn't configured. */
export function verifyAdminTotp(token: string): boolean {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) return false;
  return verifyTotp(token, secret);
}
