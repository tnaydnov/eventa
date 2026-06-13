/**
 * Application-level field encryption + blind index (SECURITY_HARDENING_PLAN §8.3).
 *
 * Platform at-rest encryption (Supabase/AWS) protects against disk theft but NOT against
 * a leaked service-role key - anyone with the key reads every column in plaintext. For the
 * most sensitive identifiers (phone, email) this util adds an application-layer envelope so
 * that a DB/key leak short of the *encryption* key does not expose the raw value.
 *
 *   - `encryptField` / `decryptField` - authenticated AES-256-GCM. Output is versioned and
 *     self-describing so the key can be rotated (decrypt falls back to FIELD_ENCRYPTION_KEY_OLD).
 *   - `blindIndex` - keyed HMAC-SHA256 of the normalized value, stored in a separate indexed
 *     column, so equality lookups ("find participant by phone") still work without plaintext.
 *
 * STAGED, NOT WIRED: this module is intentionally standalone. No column is encrypted and no
 * data is migrated yet - wiring is a separate, carefully-sequenced rollout (write ciphertext +
 * blind index → backfill → switch reads → drop plaintext). Building and testing the primitive
 * first de-risks that rollout.
 *
 * Keys (32 raw bytes, base64-encoded in env):
 *   FIELD_ENCRYPTION_KEY      - active data-encryption key (required to encrypt/decrypt)
 *   FIELD_ENCRYPTION_KEY_OLD  - previous key, accepted for decryption during rotation (optional)
 *   BLIND_INDEX_KEY           - HMAC key for blind indexes (required for blindIndex)
 *
 * Generate a key:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;          // 96-bit nonce, the GCM standard
const KEY_BYTES = 32;         // AES-256
/** Version/format marker so the scheme can evolve and ciphertext is unambiguous. */
const PREFIX = 'enc.v1.';

/** Parse a base64 32-byte key from env. Returns null when unset; throws on wrong length. */
function loadKey(envName: 'FIELD_ENCRYPTION_KEY' | 'FIELD_ENCRYPTION_KEY_OLD'): Buffer | null {
  const raw = process.env[envName];
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(`${envName} must decode to ${KEY_BYTES} bytes (got ${buf.length}). Use a base64-encoded 32-byte key.`);
  }
  return buf;
}

/** True when the active data-encryption key is configured. */
export function isFieldEncryptionConfigured(): boolean {
  return !!process.env.FIELD_ENCRYPTION_KEY;
}

/** True when a string is in our versioned ciphertext format. */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM under FIELD_ENCRYPTION_KEY.
 * Output: `enc.v1.<ivB64>.<ciphertextB64>.<authTagB64>`.
 * Throws if the key is not configured (so plaintext is never stored by mistake).
 */
export function encryptField(plaintext: string): string {
  const key = loadKey('FIELD_ENCRYPTION_KEY');
  if (!key) throw new Error('FIELD_ENCRYPTION_KEY not configured');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, ciphertext, tag].map((b) => b.toString('base64')).join('.');
}

/**
 * Decrypt a value produced by `encryptField`. Tries the active key, then
 * FIELD_ENCRYPTION_KEY_OLD (rotation window). Values that are NOT in our ciphertext
 * format are returned unchanged - this lets a staged rollout read mixed
 * plaintext/ciphertext columns safely. Throws on tamper or wrong key.
 */
export function decryptField(value: string): string {
  if (!isEncrypted(value)) return value; // passthrough for not-yet-encrypted data

  const parts = value.slice(PREFIX.length).split('.');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, 'base64'));

  const keys = [loadKey('FIELD_ENCRYPTION_KEY'), loadKey('FIELD_ENCRYPTION_KEY_OLD')]
    .filter((k): k is Buffer => k !== null);
  if (keys.length === 0) throw new Error('FIELD_ENCRYPTION_KEY not configured');

  let lastErr: unknown;
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
      lastErr = err; // try the next (old) key
    }
  }
  throw new Error(`Decryption failed: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`);
}

/**
 * Deterministic keyed HMAC-SHA256 of a normalized value, hex-encoded - a "blind index"
 * for equality lookups on an encrypted column without storing plaintext. Same input →
 * same index (so it can be queried), but the index is not reversible without the key.
 *
 * Normalization is intentionally minimal (trim). Callers should pass a domain-normalized
 * value (e.g. an E.164 phone, or a lower-cased email) so equivalent inputs collide.
 */
export function blindIndex(value: string): string {
  const raw = process.env.BLIND_INDEX_KEY;
  if (!raw) throw new Error('BLIND_INDEX_KEY not configured');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`BLIND_INDEX_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}).`);
  }
  return crypto.createHmac('sha256', key).update(value.trim()).digest('hex');
}
