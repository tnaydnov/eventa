'use client';

import {
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react';
import { OTP_LENGTH } from '@/lib/config';

interface OtpInputProps {
  /** Current OTP value as a string of digits (may be shorter than length) */
  value: string;
  /** Called when the value changes */
  onChange: (value: string) => void;
  /** Called when all digits are filled */
  onComplete: (code: string) => void;
  /** Number of digit boxes (defaults to OTP_LENGTH from config) */
  length?: number;
  disabled?: boolean;
  error?: string;
}

/** Only allow single digits */
const DIGIT_RE = /^\d$/;

/**
 * OtpInput - 6-box one-time-password input with auto-advance,
 * backspace navigation, paste support, and auto-submit on completion.
 *
 * Renders each digit in its own <input> for a polished mobile UX.
 * The entire group is rendered LTR within the RTL page (numbers read left-to-right).
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  length = OTP_LENGTH,
  disabled,
  error,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync refs array length
  useEffect(() => {
    refs.current = refs.current.slice(0, length);
  }, [length]);

  /** Focus a specific box index (clamped) */
  const focusBox = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, length - 1));
      refs.current[clamped]?.focus();
    },
    [length],
  );

  /** Build new value by setting digit at index */
  const setDigitAt = useCallback(
    (idx: number, digit: string) => {
      const chars = value.padEnd(length, ' ').split('');
      chars[idx] = digit;
      const newVal = chars.join('').replace(/ /g, '').slice(0, length);
      onChange(newVal);
      return newVal;
    },
    [value, length, onChange],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>, idx: number) => {
      const char = e.target.value.slice(-1); // take last char (Android may send full value)
      if (!DIGIT_RE.test(char)) {
        e.target.value = '';
        return;
      }
      const newVal = setDigitAt(idx, char);
      // Auto-advance
      if (idx < length - 1) {
        focusBox(idx + 1);
      }
      // Auto-submit when all digits filled
      if (newVal.length === length) {
        // Small delay so the UI can render the last digit before submitting
        setTimeout(() => onComplete(newVal), 50);
      }
    },
    [length, focusBox, setDigitAt, onComplete],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (value[idx]) {
          // Clear current box
          setDigitAt(idx, ' ');
        } else if (idx > 0) {
          // Move to previous box and clear it
          setDigitAt(idx - 1, ' ');
          focusBox(idx - 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // In LTR context, left = previous
        focusBox(idx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusBox(idx + 1);
      }
    },
    [value, focusBox, setDigitAt],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;
      onChange(pasted);
      // Focus last filled box or the next empty one
      focusBox(Math.min(pasted.length, length - 1));
      // Auto-submit if complete
      if (pasted.length === length) {
        setTimeout(() => onComplete(pasted), 50);
      }
    },
    [length, onChange, focusBox, onComplete],
  );

  /** Auto-focus the first empty box on mount */
  useEffect(() => {
    if (!disabled) {
      const firstEmpty = value.length < length ? value.length : length - 1;
      focusBox(firstEmpty);
    }
    // Only on mount / when re-enabled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <label
        id="otp-label"
        style={{
          display: 'block',
          fontSize: 14,
          color: 'var(--text-muted)',
          marginBottom: 6,
          textAlign: 'start',
        }}
      >
        קוד אימות
      </label>

      <div
        role="group"
        aria-labelledby="otp-label"
        style={{
          display: 'flex',
          direction: 'ltr',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            disabled={disabled}
            value={value[i] || ''}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            aria-label={`ספרה ${i + 1} מתוך ${length}`}
            aria-invalid={!!error}
            aria-describedby={error ? 'otp-error' : undefined}
            style={{
              width: 44,
              height: 52,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 0,
              background: 'rgba(255, 255, 255, 0.12)',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--glass-border)'}`,
              borderRadius: 10,
              color: 'var(--foreground)',
              outline: 'none',
              caretColor: 'var(--primary)',
              transition: 'border-color 0.25s ease',
            }}
          />
        ))}
      </div>

      {error && (
        <p
          id="otp-error"
          role="alert"
          style={{
            color: 'var(--danger)',
            fontSize: 13,
            marginTop: 6,
            textAlign: 'start',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
