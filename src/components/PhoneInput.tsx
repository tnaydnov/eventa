'use client';

import { useRef, useState, useCallback, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { IL_MOBILE_PREFIXES } from '@/lib/constants';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

/** Prefix displayed (non-editable) in front of the phone input. */
const DIAL_CODE = '+972';

/** Regex: digits only */
const DIGITS_RE = /\D/g;

/** Max local digits (without leading 0): e.g. 501234567 = 9 digits */
const MAX_LOCAL_DIGITS = 9;

/**
 * Format local digits as XX-XXXXXXX for display
 * e.g. "501234567" → "50-1234567"
 */
function formatLocal(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/**
 * Validate that the local digits form a valid Israeli mobile number.
 * Expects digits without leading 0, e.g. "501234567".
 * Checks that "0" + first 2 digits match an IL_MOBILE_PREFIXES entry.
 */
function isValidLocalMobile(digits: string): boolean {
  if (digits.length !== MAX_LOCAL_DIGITS) return false;
  const prefix = `0${digits.slice(0, 2)}`;
  return (IL_MOBILE_PREFIXES as readonly string[]).includes(prefix);
}

/**
 * PhoneInput - Israeli mobile phone input with fixed +972 prefix.
 *
 * The user types the local part (without leading 0) and the value
 * emitted via `onChange` is the raw local digits (e.g. "501234567").
 * The join page is responsible for normalizing to E.164 before
 * sending to the API.
 */
export default function PhoneInput({ value, onChange, disabled, error }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(DIGITS_RE, '').slice(0, MAX_LOCAL_DIGITS);
      onChange(raw);
    },
    [onChange],
  );

  const handleBlur = useCallback(
    (_e: FocusEvent<HTMLInputElement>) => {
      setTouched(true);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Allow form submission on Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        const form = (e.target as HTMLInputElement).closest('form');
        form?.requestSubmit();
      }
    },
    [],
  );

  // Determine validation error (only after blur)
  const validationError =
    touched && value.length > 0 && !isValidLocalMobile(value)
      ? 'מספר סלולרי ישראלי לא תקין'
      : undefined;

  const displayError = error || validationError;

  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <label
        htmlFor="phone-input"
        style={{
          display: 'block',
          fontSize: 14,
          color: 'var(--text-muted)',
          marginBottom: 6,
          textAlign: 'start',
        }}
      >
        מספר טלפון
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          direction: 'ltr',
          background: 'rgba(255, 255, 255, 0.12)',
          border: `1px solid ${displayError ? 'var(--danger)' : 'var(--glass-border)'}`,
          borderRadius: 10,
          overflow: 'hidden',
          transition: 'border-color 0.25s ease',
        }}
      >
        {/* Fixed dial code */}
        <span
          aria-hidden="true"
          style={{
            padding: '12px 0 12px 12px',
            fontSize: 15,
            color: 'var(--text-muted)',
            userSelect: 'none',
            flexShrink: 0,
            letterSpacing: 0.5,
          }}
        >
          {DIAL_CODE}
        </span>

        <input
          ref={inputRef}
          id="phone-input"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          placeholder="50-1234567"
          value={formatLocal(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-invalid={!!displayError}
          aria-describedby={displayError ? 'phone-error' : undefined}
          style={{
            flex: 1,
            padding: '12px 12px 12px 8px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--foreground)',
            fontSize: 16,
            letterSpacing: 1,
            width: '100%',
            minWidth: 0,
          }}
        />
      </div>

      {displayError && (
        <p
          id="phone-error"
          role="alert"
          style={{
            color: 'var(--danger)',
            fontSize: 13,
            marginTop: 6,
            textAlign: 'start',
          }}
        >
          {displayError}
        </p>
      )}
    </div>
  );
}
