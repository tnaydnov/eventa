/**
 * Phone number normalization and validation utilities.
 * All phone numbers are stored in E.164 format: +972501234567
 */
import { IL_MOBILE_PREFIXES } from '@/lib/constants';

/**
 * Normalize a phone number to E.164 format.
 * Handles all common Israeli phone input styles:
 *  - +972501234567  / +972-50-1234567
 *  - +9720501234567 / +972-050-1234567  (redundant zero)
 *  - 972501234567   / 972-50-1234567
 *  - 9720501234567  (redundant zero, no plus)
 *  - 00972501234567 / 009720501234567  (international dial prefix)
 *  - 050-1234567    / 0501234567
 *  - 501234567      (bare, leading zero stripped by Excel)
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

  // +972 with redundant leading zero: +9720 + 9 digits (e.g., +9720501234567)
  if (/^\+9720\d{9}$/.test(cleaned)) {
    return '+972' + cleaned.slice(5);
  }

  // Without plus: 972 + 9 digits
  if (/^972\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Without plus, redundant zero: 9720 + 9 digits
  if (/^9720\d{9}$/.test(cleaned)) {
    return '+972' + cleaned.slice(4);
  }

  // International dialing prefix: 00972 + 9 digits
  if (/^00972\d{9}$/.test(cleaned)) {
    return '+' + cleaned.slice(2);
  }

  // International dialing prefix with redundant zero: 009720 + 9 digits
  if (/^009720\d{9}$/.test(cleaned)) {
    return '+972' + cleaned.slice(6);
  }

  // Local format: 05X + 7 digits
  if (/^0[5]\d{8}$/.test(cleaned)) {
    return '+972' + cleaned.slice(1);
  }

  // Bare number without leading zero (Excel strips it): 5X + 7 digits
  if (/^5\d{8}$/.test(cleaned)) {
    return '+972' + cleaned;
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
