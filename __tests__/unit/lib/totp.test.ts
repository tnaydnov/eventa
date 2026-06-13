/**
 * Unit tests for lib/totp.ts — RFC 6238 TOTP.
 *
 * Known-answer vectors are taken from RFC 6238 Appendix B (SHA-1 variant),
 * whose shared secret is the ASCII string "12345678901234567890". We Base32-encode
 * that seed inline (so we don't depend on a hand-copied constant) and assert the
 * documented 8-digit codes.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { generateTotp, verifyTotp, base32Decode } from '@/lib/totp';

/** Minimal RFC 4648 Base32 encoder (test-only, to derive the RFC seed). */
function base32Encode(bytes: Buffer): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

const RFC_SEED = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('base32Decode', () => {
  it('round-trips the RFC seed', () => {
    expect(base32Decode(RFC_SEED).toString('ascii')).toBe('12345678901234567890');
  });

  it('is case-insensitive and ignores padding/whitespace', () => {
    expect(base32Decode(RFC_SEED.toLowerCase()).toString('ascii')).toBe('12345678901234567890');
    expect(base32Decode('JBSWY3DP').length).toBeGreaterThan(0);
  });

  it('throws on invalid characters', () => {
    expect(() => base32Decode('0189!')).toThrow();
  });
});

describe('generateTotp — RFC 6238 known-answer vectors (SHA-1, 8 digits)', () => {
  const vectors: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ];
  for (const [seconds, expected] of vectors) {
    it(`T=${seconds} → ${expected}`, () => {
      expect(generateTotp(RFC_SEED, { t: seconds * 1000, digits: 8 })).toBe(expected);
    });
  }

  it('derives the 6-digit code as the trailing digits', () => {
    expect(generateTotp(RFC_SEED, { t: 59_000, digits: 6 })).toBe('287082');
  });
});

describe('verifyTotp', () => {
  it('accepts the current code', () => {
    const t = 59_000;
    expect(verifyTotp('287082', RFC_SEED, { t })).toBe(true);
  });

  it('accepts a code from the adjacent window (±1 step skew)', () => {
    // Code generated for the previous 30s step is still accepted at the next step.
    const prev = generateTotp(RFC_SEED, { t: 59_000 });
    expect(verifyTotp(prev, RFC_SEED, { t: 59_000 + 30_000 })).toBe(true);
  });

  it('rejects a code two steps away', () => {
    const old = generateTotp(RFC_SEED, { t: 59_000 });
    expect(verifyTotp(old, RFC_SEED, { t: 59_000 + 90_000 })).toBe(false);
  });

  it('rejects the wrong code', () => {
    expect(verifyTotp('000000', RFC_SEED, { t: 59_000 })).toBe(false);
  });

  it('rejects non-numeric / empty input', () => {
    expect(verifyTotp('', RFC_SEED, { t: 59_000 })).toBe(false);
    expect(verifyTotp('abcdef', RFC_SEED, { t: 59_000 })).toBe(false);
  });

  it('rejects when the secret is invalid base32', () => {
    expect(verifyTotp('287082', '0!@#', { t: 59_000 })).toBe(false);
  });
});
