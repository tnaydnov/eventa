/**
 * Unit tests for lib/sanitize.ts - HTML sanitization
 * Tests: U-SAN-01 through U-SAN-11+
 *
 * NOTE: Runs in jsdom environment to test client-side DOMPurify path.
 * Server-side regex path is tested separately below.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the server-side path by manipulating `window`
describe('sanitize (server-side path)', () => {
  let sanitize: typeof import('@/lib/sanitize').sanitize;
  let sanitizeWithLimit: typeof import('@/lib/sanitize').sanitizeWithLimit;

  beforeEach(async () => {
    // Force server environment by removing window
    vi.stubGlobal('window', undefined);
    // Clear module cache to re-evaluate
    vi.resetModules();
    const mod = await import('@/lib/sanitize');
    sanitize = mod.sanitize;
    sanitizeWithLimit = mod.sanitizeWithLimit;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('U-SAN-01: strips HTML tags', () => {
    expect(sanitize('<b>bold</b>')).toBe('bold');
  });

  it('U-SAN-02: strips script tags', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('U-SAN-03: strips nested tags', () => {
    expect(sanitize('<div><b>hello</b></div>')).toBe('hello');
  });

  it('U-SAN-04: decodes HTML entities after stripping', () => {
    expect(sanitize('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('alert(1)');
  });

  it('U-SAN-05: handles double-encoded entities', () => {
    // After first pass: entities decode to tags, second pass strips them
    const input = '&lt;b&gt;bold&lt;/b&gt;';
    const result = sanitize(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('U-SAN-06: preserves plain text', () => {
    expect(sanitize('Hello, World!')).toBe('Hello, World!');
  });

  it('U-SAN-07: trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('U-SAN-08: handles numeric character references', () => {
    expect(sanitize('&#60;b&#62;bold&#60;/b&#62;')).toBe('bold');
  });

  it('U-SAN-09: handles hex character references', () => {
    expect(sanitize('&#x3C;b&#x3E;bold&#x3C;/b&#x3E;')).toBe('bold');
  });

  it('U-SAN-10: handles empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('handles &amp; entity', () => {
    expect(sanitize('&amp;')).toBe('&');
  });

  it('handles &quot; entity', () => {
    expect(sanitize('&quot;hello&quot;')).toBe('"hello"');
  });

  it('strips img tags', () => {
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe('');
  });

  it('strips event handler attributes', () => {
    expect(sanitize('<div onclick="alert(1)">click</div>')).toBe('click');
  });
});

describe('sanitizeWithLimit (server-side path)', () => {
  let sanitizeWithLimit: typeof import('@/lib/sanitize').sanitizeWithLimit;

  beforeEach(async () => {
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const mod = await import('@/lib/sanitize');
    sanitizeWithLimit = mod.sanitizeWithLimit;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('U-SAN-11: truncates to max length', () => {
    const result = sanitizeWithLimit('Hello, World!', 5);
    expect(result).toBe('Hello');
    expect(result.length).toBe(5);
  });

  it('does not truncate short text', () => {
    expect(sanitizeWithLimit('Hi', 100)).toBe('Hi');
  });

  it('sanitizes before truncating', () => {
    const result = sanitizeWithLimit('<b>Hello</b> World', 5);
    expect(result).toBe('Hello');
  });

  it('handles zero maxLength', () => {
    expect(sanitizeWithLimit('test', 0)).toBe('');
  });
});
