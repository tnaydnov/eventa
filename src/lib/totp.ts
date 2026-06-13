/**
 * TOTP (Time-based One-Time Password, RFC 6238) — pure Node `crypto`, no native deps.
 *
 * Used for optional admin two-factor authentication. Compatible with standard
 * authenticator apps (Google Authenticator, Authy, 1Password, …) which use:
 *   - a Base32-encoded shared secret (RFC 4648)
 *   - HMAC-SHA1, 30-second time step, 6 digits
 *
 * Only verification + generation are needed here; secret provisioning is done
 * once, out of band (see the operator note in `admin-credentials.ts`).
 */
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode an RFC 4648 Base32 string to bytes.
 * Case-insensitive; ignores whitespace and `=` padding (as produced by
 * authenticator apps). Throws on invalid characters.
 */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226) — counter-based one-time code with dynamic truncation. */
function hotp(secret: Buffer, counter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter. counter is well within the safe-integer range
  // (epochSeconds/30 ≈ 5.6e7), so BigInt conversion is exact.
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

export interface TotpOptions {
  /** Reference time in ms (default: now). */
  t?: number;
  /** Time step in seconds (default: 30). */
  step?: number;
  /** Number of digits (default: 6). */
  digits?: number;
}

/** Generate the TOTP code for the given time (mainly for tests / provisioning). */
export function generateTotp(secretBase32: string, opts: TotpOptions = {}): string {
  const { t = Date.now(), step = 30, digits = 6 } = opts;
  const counter = Math.floor(t / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/**
 * Verify a TOTP token, allowing ±`window` time steps of clock skew (default ±1,
 * i.e. the previous, current and next 30-second windows). Uses a timing-safe
 * comparison and rejects non-numeric input.
 */
export function verifyTotp(
  token: string,
  secretBase32: string,
  opts: TotpOptions & { window?: number } = {},
): boolean {
  const { t = Date.now(), step = 30, digits = 6, window = 1 } = opts;
  if (!token || !/^\d+$/.test(token)) return false;

  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }

  const counter = Math.floor(t / 1000 / step);
  const tokenBuf = Buffer.from(token);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(secret, counter + i, digits);
    const candBuf = Buffer.from(candidate);
    if (candBuf.length === tokenBuf.length && crypto.timingSafeEqual(candBuf, tokenBuf)) {
      return true;
    }
  }
  return false;
}
