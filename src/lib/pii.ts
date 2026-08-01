/**
 * PII encryption helpers — thin wrappers around field-crypto.ts for use in routes.
 *
 * Strategy: encrypted-only (all plaintext PII columns have been dropped).
 *   - Every PII field is stored in `<field>_enc` TEXT column (AES-256-GCM ciphertext)
 *     and, for lookup fields, `<field>_bi` TEXT column (HMAC-SHA256 blind index).
 *   - Reads: decrypt `_enc`. Falls back to plaintext sibling only if `_enc` is null
 *     (should not happen after migration 047 drops old columns).
 *   - Writes: write ciphertext to `_enc` + blind index to `_bi` only.
 *   - Lookups: always use blind index `_bi` column.
 *
 * When FIELD_ENCRYPTION_KEY is NOT set, all helpers are transparent no-ops so the
 * app keeps working normally and the backfill script can be run at any time.
 */

import {
  encryptField,
  decryptField,
  blindIndex,
  isFieldEncryptionConfigured,
  isEncrypted,
} from '@/lib/field-crypto';
import { logger } from '@/lib/logger';

// ─── Core helpers ────────────────────────────────────────────────────────────

/**
 * Encrypt a PII value. Returns null when input is null/empty or when encryption
 * is not configured (graceful no-op so the app works without the keys).
 */
export function encryptPii(value: string | null | undefined): string | null {
  if (!value || !isFieldEncryptionConfigured()) return null;
  try {
    return encryptField(value);
  } catch (err) {
    logger.error('[PII] encryptPii failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Decrypt a PII value. Falls back to the raw plaintext sibling column when:
 *   - `enc` is null (not yet backfilled), or
 *   - decryption fails (key mismatch / corrupted — log + return fallback).
 * This makes reads safe during the transition period.
 */
export function decryptPii(enc: string | null | undefined, plaintext: string | null | undefined): string | null {
  // Prefer decrypted enc column
  if (enc) {
    try {
      return decryptField(enc);
    } catch (err) {
      logger.error('[PII] decryptPii failed – returning plaintext fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return plaintext ?? null;
}

/**
 * Compute the blind HMAC index for a phone / email lookup. Returns null when
 * the value is absent or BLIND_INDEX_KEY is not set (falls back to plaintext lookup).
 */
export function computeBlindIndex(value: string | null | undefined): string | null {
  if (!value || !process.env.BLIND_INDEX_KEY) return null;
  try {
    return blindIndex(value);
  } catch (err) {
    logger.error('[PII] computeBlindIndex failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Returns the write-columns for a phone field:
 *   { phone_enc, phone_bi }
 * The old plaintext `phone` column has been dropped; only encrypted values are written.
 */
export function phoneWriteFields(phone: string | null | undefined): {
  phone_enc: string | null;
  phone_bi: string | null;
} {
  const p = phone || null;
  return {
    phone_enc: encryptPii(p),
    phone_bi: computeBlindIndex(p),
  };
}

/** Same as phoneWriteFields but for email. */
export function emailWriteFields(email: string | null | undefined): {
  email_enc: string | null;
  email_bi: string | null;
} {
  const e = email || null;
  return {
    email_enc: encryptPii(e),
    email_bi: computeBlindIndex(e),
  };
}

/** For a generic text field that needs encryption but no lookup (name, bio, etc.). */
export function textWriteFields<K extends string>(
  fieldName: K,
  value: string | null | undefined,
): Record<`${K}_enc`, string | null> {
  const v = value || null;
  return {
    [`${fieldName}_enc`]: encryptPii(v),
  } as Record<`${K}_enc`, string | null>;
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a phone field from a DB row. Reads from `phone_enc` (ciphertext).
 * Falls back to `phone` plaintext only during migration transition.
 */
export function readPhone(row: { phone?: string | null; phone_enc?: string | null }): string | null {
  return decryptPii(row.phone_enc, row.phone);
}

/** Same for email with `_enc` sibling. */
export function readEmail(row: { [key: string]: unknown }, emailField: string): string | null {
  const enc = row[`${emailField}_enc`] as string | null;
  const plain = row[emailField] as string | null;
  return decryptPii(enc, plain);
}

/** Read any field that has a `<fieldName>_enc` sibling. */
export function readField(row: { [key: string]: unknown }, fieldName: string): string | null {
  const enc = row[`${fieldName}_enc`] as string | null;
  const plain = row[fieldName] as string | null;
  return decryptPii(enc, plain);
}

// ─── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Build a Supabase equality filter for a phone lookup.
 * If encryption + blind index are both configured, returns { column: 'phone_bi', value: blindIndex(phone) }.
 * Otherwise falls back to { column: 'phone', value: phone } (plaintext).
 * Usage: const { column, value } = phoneLookupFilter(phone);
 *        .eq(column, value)
 */
export function phoneLookupFilter(phone: string): { column: string; value: string } {
  const bi = computeBlindIndex(phone);
  if (bi) return { column: 'phone_bi', value: bi };
  return { column: 'phone', value: phone };
}

/** Same for email. */
export function emailLookupFilter(email: string): { column: string; value: string } {
  const bi = computeBlindIndex(email);
  if (bi) return { column: 'email_bi', value: bi };
  return { column: 'email', value: email };
}

// ─── DB row decryption helpers ─────────────────────────────────────────────────

/**
 * Decrypt all known PII fields in a participant row in-place.
 * Returns a new object with decrypted values (never mutates input).
 */
export function decryptParticipantRow<T extends {
  phone?: string | null;
  phone_enc?: string | null;
  attracted_to?: string | null;
  attracted_to_enc?: string | null;
  looking_for?: string | null;
  looking_for_enc?: string | null;
  bio?: string | null;
  bio_enc?: string | null;
}>(row: T): T & { phone: string | null; attracted_to: string | null; looking_for: string | null; bio: string | null } {
  return {
    ...row,
    phone: readPhone(row),
    attracted_to: decryptPii(row.attracted_to_enc, row.attracted_to),
    looking_for: decryptPii(row.looking_for_enc, row.looking_for),
    bio: decryptPii(row.bio_enc, row.bio),
  };
}

/**
 * Decrypt all known PII fields in an event row.
 */
export function decryptEventRow<T extends {
  client_name?: string | null;
  client_name_enc?: string | null;
  client_email?: string | null;
  client_email_enc?: string | null;
  client_phone?: string | null;
  client_phone_enc?: string | null;
}>(row: T): T & { client_name: string | null; client_email: string | null; client_phone: string | null } {
  return {
    ...row,
    client_name: decryptPii(row.client_name_enc, row.client_name),
    client_email: decryptPii(row.client_email_enc, row.client_email),
    client_phone: decryptPii(row.client_phone_enc, row.client_phone),
  };
}

/**
 * Decrypt all known PII fields in an event_requests row.
 */
export function decryptRequestRow<T extends {
  contact_name?: string | null;
  contact_name_enc?: string | null;
  contact_email?: string | null;
  contact_email_enc?: string | null;
  contact_phone?: string | null;
  contact_phone_enc?: string | null;
}>(row: T): T & { contact_name: string | null; contact_email: string | null; contact_phone: string | null } {
  return {
    ...row,
    contact_name: decryptPii(row.contact_name_enc, row.contact_name),
    contact_email: decryptPii(row.contact_email_enc, row.contact_email),
    contact_phone: decryptPii(row.contact_phone_enc, row.contact_phone),
  };
}

/**
 * Decrypt a guest_phones row.
 */
export function decryptGuestPhoneRow<T extends {
  phone?: string | null;
  phone_enc?: string | null;
  guest_name?: string | null;
  guest_name_enc?: string | null;
}>(row: T): T & { phone: string | null; guest_name: string | null } {
  return {
    ...row,
    phone: readPhone(row),
    guest_name: decryptPii(row.guest_name_enc, row.guest_name),
  };
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

/** True when field encryption is fully operational (both keys set). */
export function isPiiEncryptionActive(): boolean {
  return isFieldEncryptionConfigured() && !!process.env.BLIND_INDEX_KEY;
}

export { isEncrypted };
