/**
 * Unit tests for lib/mailer.ts - sanitizeEmailHeader (email header-injection guard).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { sanitizeEmailHeader } from '@/lib/mailer';

describe('sanitizeEmailHeader', () => {
  it('leaves a normal subject unchanged', () => {
    expect(sanitizeEmailHeader('Eventa - your event is ready')).toBe('Eventa - your event is ready');
  });

  it('preserves Hebrew text and emoji (no UX change for real recipients)', () => {
    const s = 'תזכורת: העלו רשימת אורחים 🎉';
    expect(sanitizeEmailHeader(s)).toBe(s);
  });

  it('strips a CRLF-injected extra header (the core attack)', () => {
    const malicious = 'Hello\r\nBcc: attacker@evil.com';
    const out = sanitizeEmailHeader(malicious);
    expect(out).not.toContain('\r');
    expect(out).not.toContain('\n');
    expect(out).toBe('Hello Bcc: attacker@evil.com'); // folded onto one line, inert
  });

  it('strips lone LF and CR', () => {
    expect(sanitizeEmailHeader('a\nb')).toBe('a b');
    expect(sanitizeEmailHeader('a\rb')).toBe('a b');
  });

  it('strips NUL and other control characters', () => {
    expect(sanitizeEmailHeader('a\u0000b\u0001c')).toBe('a b c');
  });

  it('collapses a CRLF run into a single space and trims', () => {
    expect(sanitizeEmailHeader('  subject\r\n\r\n  ')).toBe('subject');
  });

  it('handles an empty string', () => {
    expect(sanitizeEmailHeader('')).toBe('');
  });
});
