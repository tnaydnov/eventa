/**
 * Unit tests for lib/messaging/phone-utils.ts
 * Tests: phone normalization, validation, formatting, masking
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  isValidIsraeliMobile,
  formatPhoneDisplay,
  maskPhone,
} from '@/lib/messaging/phone-utils';

// ─── normalizePhone ─────────────────────────────────────

describe('normalizePhone', () => {
  it('normalizes local format 0501234567', () => {
    expect(normalizePhone('0501234567')).toBe('+972501234567');
  });

  it('normalizes local format with dashes 050-123-4567', () => {
    expect(normalizePhone('050-123-4567')).toBe('+972501234567');
  });

  it('normalizes local format with spaces 050 123 4567', () => {
    expect(normalizePhone('050 123 4567')).toBe('+972501234567');
  });

  it('normalizes E.164 format +972501234567', () => {
    expect(normalizePhone('+972501234567')).toBe('+972501234567');
  });

  it('normalizes E.164 with dashes +972-50-123-4567', () => {
    expect(normalizePhone('+972-50-123-4567')).toBe('+972501234567');
  });

  it('normalizes without plus: 972501234567', () => {
    expect(normalizePhone('972501234567')).toBe('+972501234567');
  });

  it('normalizes with parentheses (050)1234567', () => {
    expect(normalizePhone('(050)1234567')).toBe('+972501234567');
  });

  it('normalizes with dots 050.123.4567', () => {
    expect(normalizePhone('050.123.4567')).toBe('+972501234567');
  });

  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull();
  });

  it('returns null for too short number', () => {
    expect(normalizePhone('050123')).toBeNull();
  });

  it('returns null for too long number', () => {
    expect(normalizePhone('050123456789')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(normalizePhone('abcdefghij')).toBeNull();
  });

  it('returns null for international non-IL number', () => {
    expect(normalizePhone('+14155551234')).toBeNull();
  });

  it('returns null for landline (02/03/04)', () => {
    expect(normalizePhone('021234567')).toBeNull();
  });

  it('handles all valid Israeli mobile prefixes', () => {
    const prefixes = ['050', '051', '052', '053', '054', '055', '056', '058'];
    for (const prefix of prefixes) {
      const phone = `${prefix}1234567`;
      const normalized = normalizePhone(phone);
      expect(normalized).toBe(`+972${prefix.slice(1)}1234567`);
    }
  });

  // ── New format support ────────────────────────────────

  it('normalizes +972 with redundant leading zero +9720501234567', () => {
    expect(normalizePhone('+9720501234567')).toBe('+972501234567');
  });

  it('normalizes +972-050-1234567 (dashes + redundant zero)', () => {
    expect(normalizePhone('+972-050-1234567')).toBe('+972501234567');
  });

  it('normalizes 9720501234567 (no plus, redundant zero)', () => {
    expect(normalizePhone('9720501234567')).toBe('+972501234567');
  });

  it('normalizes 00972501234567 (international dial prefix)', () => {
    expect(normalizePhone('00972501234567')).toBe('+972501234567');
  });

  it('normalizes 009720501234567 (international dial + redundant zero)', () => {
    expect(normalizePhone('009720501234567')).toBe('+972501234567');
  });

  it('normalizes bare 501234567 (Excel-stripped leading zero)', () => {
    expect(normalizePhone('501234567')).toBe('+972501234567');
  });

  it('normalizes bare 521234567 (Excel-stripped, prefix 052)', () => {
    expect(normalizePhone('521234567')).toBe('+972521234567');
  });
});

// ─── isValidIsraeliMobile ───────────────────────────────

describe('isValidIsraeliMobile', () => {
  it('returns true for valid mobile number 0501234567', () => {
    expect(isValidIsraeliMobile('0501234567')).toBe(true);
  });

  it('returns true for E.164 format', () => {
    expect(isValidIsraeliMobile('+972521234567')).toBe(true);
  });

  it('returns true for all valid prefixes', () => {
    const prefixes = ['050', '051', '052', '053', '054', '055', '056', '058'];
    for (const prefix of prefixes) {
      expect(isValidIsraeliMobile(`${prefix}1234567`)).toBe(true);
    }
  });

  it('returns false for invalid prefix 057', () => {
    expect(isValidIsraeliMobile('0571234567')).toBe(false);
  });

  it('returns false for invalid prefix 059', () => {
    expect(isValidIsraeliMobile('0591234567')).toBe(false);
  });

  it('returns false for landline number', () => {
    expect(isValidIsraeliMobile('031234567')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidIsraeliMobile('')).toBe(false);
  });

  it('returns false for non-numeric', () => {
    expect(isValidIsraeliMobile('not-a-phone')).toBe(false);
  });
});

// ─── formatPhoneDisplay ─────────────────────────────────

describe('formatPhoneDisplay', () => {
  it('formats E.164 to +972-50-123-4567', () => {
    expect(formatPhoneDisplay('+972501234567')).toBe('+972-50-123-4567');
  });

  it('formats different prefix +972-52-987-6543', () => {
    expect(formatPhoneDisplay('+972529876543')).toBe('+972-52-987-6543');
  });

  it('returns raw string for non-E.164 input', () => {
    expect(formatPhoneDisplay('0501234567')).toBe('0501234567');
  });

  it('returns raw string for wrong length', () => {
    expect(formatPhoneDisplay('+97250123')).toBe('+97250123');
  });

  it('returns raw string for non-IL country code', () => {
    expect(formatPhoneDisplay('+14155551234')).toBe('+14155551234');
  });
});

// ─── maskPhone ──────────────────────────────────────────

describe('maskPhone', () => {
  it('masks middle digits: +972-50-***-4567', () => {
    expect(maskPhone('+972501234567')).toBe('+972-50-***-4567');
  });

  it('masks different number: +972-52-***-6543', () => {
    expect(maskPhone('+972529876543')).toBe('+972-52-***-6543');
  });

  it('returns *** for non-E.164 input', () => {
    expect(maskPhone('0501234567')).toBe('***');
  });

  it('returns *** for wrong length', () => {
    expect(maskPhone('+97250123')).toBe('***');
  });

  it('returns *** for non-IL country code', () => {
    expect(maskPhone('+14155551234')).toBe('***');
  });
});
