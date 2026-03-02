/**
 * Phone number normalization and validation utilities.
 * All phone numbers are stored in E.164 format: +972501234567
 */
import { IL_MOBILE_PREFIXES } from '@/lib/constants';

/**
 * Normalize a phone number to E.164 format.
 * Handles:
 *  - +972-50-1234567
 *  - 972501234567
 *  - 050-1234567
 *  - 0501234567
 *
 * Returns null if phone is invalid.
 */
export function normalizePhone(raw: string): string | null {
  // Strip all whitespace, dashes, parentheses, dots
  const cleaned = raw.replace(/[\s\-().]/g, '');

  // Already E.164: +972 + 9 digits
  if (/^\+972\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Without plus: 972 + 9 digits
  if (/^972\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Local format: 05X + 7 digits
  if (/^0[5]\d{8}$/.test(cleaned)) {
    return '+972' + cleaned.slice(1);
  }

  return null;
}

/**
 * Validate that a phone is a valid Israeli mobile number.
 */
export function isValidIsraeliMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  // Check prefix matches known Israeli mobile prefixes
  const localForm = '0' + normalized.slice(4);
  return IL_MOBILE_PREFIXES.some((prefix) => localForm.startsWith(prefix));
}

/**
 * Format phone for display: +972-50-123-4567
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith('+972') || e164.length !== 13) return e164;
  const local = e164.slice(4);
  return `+972-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
}

/**
 * Mask phone for privacy display: +972-50-***-4567
 */
export function maskPhone(e164: string): string {
  if (!e164.startsWith('+972') || e164.length !== 13) return '***';
  const local = e164.slice(4);
  return `+972-${local.slice(0, 2)}-***-${local.slice(5)}`;
}
