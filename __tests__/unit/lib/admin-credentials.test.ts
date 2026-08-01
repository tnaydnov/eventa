/**
 * Unit tests for lib/admin-credentials.ts - admin password (scrypt + plaintext) and TOTP gate.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  hasAdminCredential,
  verifyAdminPassword,
} from '@/lib/admin-credentials';

/** Build a `scrypt$N$r$p$salt$hash` string for a known password (matches module format). */
function makeScryptHash(password: string, N = 16384, r = 8, p = 1): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N, r, p, maxmem: 256 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const ENV_KEYS = ['ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('hasAdminCredential', () => {
  it('false when neither var is set', () => {
    expect(hasAdminCredential()).toBe(false);
  });
  it('true when plaintext is set', () => {
    process.env.ADMIN_PASSWORD = 'pw';
    expect(hasAdminCredential()).toBe(true);
  });
  it('true when hash is set', () => {
    process.env.ADMIN_PASSWORD_HASH = makeScryptHash('pw');
    expect(hasAdminCredential()).toBe(true);
  });
});

describe('verifyAdminPassword - plaintext fallback', () => {
  beforeEach(() => { process.env.ADMIN_PASSWORD = 'super-secret-pw'; });

  it('accepts the correct password', () => {
    expect(verifyAdminPassword('super-secret-pw')).toBe(true);
  });
  it('rejects the wrong password', () => {
    expect(verifyAdminPassword('nope')).toBe(false);
  });
  it('rejects empty input', () => {
    expect(verifyAdminPassword('')).toBe(false);
  });
});

describe('verifyAdminPassword - scrypt hash (preferred)', () => {
  it('accepts the correct password against a scrypt hash', () => {
    process.env.ADMIN_PASSWORD_HASH = makeScryptHash('correct horse battery staple');
    expect(verifyAdminPassword('correct horse battery staple')).toBe(true);
  });
  it('rejects the wrong password against a scrypt hash', () => {
    process.env.ADMIN_PASSWORD_HASH = makeScryptHash('correct horse battery staple');
    expect(verifyAdminPassword('wrong')).toBe(false);
  });
  it('hash takes precedence over plaintext when both are set', () => {
    process.env.ADMIN_PASSWORD_HASH = makeScryptHash('hash-pw');
    process.env.ADMIN_PASSWORD = 'plaintext-pw';
    expect(verifyAdminPassword('hash-pw')).toBe(true);
    expect(verifyAdminPassword('plaintext-pw')).toBe(false);
  });
  it('rejects a malformed hash string', () => {
    process.env.ADMIN_PASSWORD_HASH = 'not-a-valid-hash';
    expect(verifyAdminPassword('anything')).toBe(false);
  });
});
