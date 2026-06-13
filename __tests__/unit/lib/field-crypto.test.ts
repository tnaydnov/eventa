/**
 * Unit tests for lib/field-crypto.ts — AES-256-GCM field encryption + blind index.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  encryptField,
  decryptField,
  isEncrypted,
  isFieldEncryptionConfigured,
  blindIndex,
} from '@/lib/field-crypto';

const KEY_A = crypto.randomBytes(32).toString('base64');
const KEY_B = crypto.randomBytes(32).toString('base64');
const INDEX_KEY = crypto.randomBytes(32).toString('base64');

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.FIELD_ENCRYPTION_KEY = KEY_A;
  process.env.BLIND_INDEX_KEY = INDEX_KEY;
  delete process.env.FIELD_ENCRYPTION_KEY_OLD;
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('encryptField / decryptField', () => {
  it('round-trips a value', () => {
    const ct = encryptField('+972501234567');
    expect(decryptField(ct)).toBe('+972501234567');
  });

  it('produces versioned, self-describing ciphertext', () => {
    const ct = encryptField('hello');
    expect(ct.startsWith('enc.v1.')).toBe(true);
    expect(isEncrypted(ct)).toBe(true);
  });

  it('is non-deterministic (random IV per call)', () => {
    expect(encryptField('same')).not.toBe(encryptField('same'));
  });

  it('round-trips unicode and empty strings', () => {
    expect(decryptField(encryptField(''))).toBe('');
    expect(decryptField(encryptField('שלום עולם 👋'))).toBe('שלום עולם 👋');
  });

  it('passes through non-ciphertext values unchanged (staged rollout)', () => {
    expect(decryptField('0501234567')).toBe('0501234567');
    expect(isEncrypted('0501234567')).toBe(false);
  });

  it('detects tampering via the GCM auth tag', () => {
    const ct = encryptField('secret');
    // Flip a character in the ciphertext body.
    const tampered = ct.slice(0, -2) + (ct.endsWith('A') ? 'B' : 'A') + ct.slice(-1);
    expect(() => decryptField(tampered)).toThrow();
  });

  it('throws when encrypting without a configured key', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => encryptField('x')).toThrow(/not configured/);
  });

  it('throws on a wrong-length key', () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
    expect(() => encryptField('x')).toThrow(/32 bytes/);
  });

  it('decrypts with FIELD_ENCRYPTION_KEY_OLD after rotation', () => {
    // Encrypt under key A, then rotate: A becomes OLD, B becomes active.
    const ct = encryptField('rotate-me');
    process.env.FIELD_ENCRYPTION_KEY = KEY_B;
    process.env.FIELD_ENCRYPTION_KEY_OLD = KEY_A;
    expect(decryptField(ct)).toBe('rotate-me');
  });

  it('fails to decrypt when neither key matches', () => {
    const ct = encryptField('x');
    process.env.FIELD_ENCRYPTION_KEY = KEY_B; // wrong key, no OLD
    expect(() => decryptField(ct)).toThrow(/Decryption failed/);
  });
});

describe('isFieldEncryptionConfigured', () => {
  it('reflects whether the active key is set', () => {
    expect(isFieldEncryptionConfigured()).toBe(true);
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(isFieldEncryptionConfigured()).toBe(false);
  });
});

describe('blindIndex', () => {
  it('is deterministic for the same input', () => {
    expect(blindIndex('+972501234567')).toBe(blindIndex('+972501234567'));
  });

  it('ignores surrounding whitespace', () => {
    expect(blindIndex('  +972501234567 ')).toBe(blindIndex('+972501234567'));
  });

  it('differs for different inputs', () => {
    expect(blindIndex('+972501234567')).not.toBe(blindIndex('+972507654321'));
  });

  it('is keyed (changing the key changes the index)', () => {
    const a = blindIndex('+972501234567');
    process.env.BLIND_INDEX_KEY = KEY_B;
    expect(blindIndex('+972501234567')).not.toBe(a);
  });

  it('throws when the index key is not configured', () => {
    delete process.env.BLIND_INDEX_KEY;
    expect(() => blindIndex('x')).toThrow(/not configured/);
  });

  it('produces a 64-char hex digest', () => {
    expect(blindIndex('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
