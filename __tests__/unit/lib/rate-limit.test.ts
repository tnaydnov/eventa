/**
 * Unit tests for lib/rate-limit.ts - Rate limiter
 * Tests: U-RAT-01 through U-RAT-10+
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, checkRateLimitAsync, isDistributedRateLimitEnabled, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

// Each test uses a unique key to avoid cross-test pollution
let keyCounter = 0;
function uniqueKey() {
  return `test-ip-${++keyCounter}-${Date.now()}`;
}

describe('checkRateLimit', () => {
  it('U-RAT-01: allows first request', () => {
    const result = checkRateLimit(uniqueKey());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29); // 30 - 1
    expect(result.resetMs).toBe(0);
  });

  it('U-RAT-02: allows requests up to limit', () => {
    const key = uniqueKey();
    for (let i = 0; i < 30; i++) {
      const r = checkRateLimit(key);
      expect(r.allowed).toBe(true);
    }
  });

  it('U-RAT-03: blocks request at limit+1', () => {
    const key = uniqueKey();
    for (let i = 0; i < 30; i++) checkRateLimit(key);
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it('U-RAT-04: uses custom config', () => {
    const key = uniqueKey();
    const config = { maxRequests: 2, windowMs: 60_000 };
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(false);
  });

  it('U-RAT-05: remaining decrements correctly', () => {
    const key = uniqueKey();
    const config = { maxRequests: 5, windowMs: 60_000 };
    expect(checkRateLimit(key, config).remaining).toBe(4);
    expect(checkRateLimit(key, config).remaining).toBe(3);
    expect(checkRateLimit(key, config).remaining).toBe(2);
    expect(checkRateLimit(key, config).remaining).toBe(1);
    expect(checkRateLimit(key, config).remaining).toBe(0);
  });

  it('U-RAT-06: different keys are independent', () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    const config = { maxRequests: 1, windowMs: 60_000 };
    expect(checkRateLimit(key1, config).allowed).toBe(true);
    expect(checkRateLimit(key2, config).allowed).toBe(true);
    expect(checkRateLimit(key1, config).allowed).toBe(false);
    expect(checkRateLimit(key2, config).allowed).toBe(false);
  });

  it('U-RAT-07: returns positive resetMs when blocked', () => {
    const key = uniqueKey();
    const config = { maxRequests: 1, windowMs: 60_000 };
    checkRateLimit(key, config);
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.resetMs).toBeGreaterThan(0);
    expect(result.resetMs).toBeLessThanOrEqual(60_000);
  });

  it('U-RAT-08: allows requests after window expires (via mocked time)', () => {
    const key = uniqueKey();
    const config = { maxRequests: 1, windowMs: 1000 };

    vi.useFakeTimers();
    checkRateLimit(key, config);
    expect(checkRateLimit(key, config).allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, config).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe('getClientIp', () => {
  it('U-RAT-09: extracts IP from x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(headers)).toBe('1.2.3.4');
  });

  it('extracts single IP from x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '10.0.0.1' });
    expect(getClientIp(headers)).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '2.3.4.5' });
    expect(getClientIp(headers)).toBe('2.3.4.5');
  });

  it('falls back to cf-connecting-ip', () => {
    const headers = new Headers({ 'cf-connecting-ip': '3.4.5.6' });
    expect(getClientIp(headers)).toBe('3.4.5.6');
  });

  it('U-RAT-10: returns unknown when no IP headers', () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const headers = new Headers({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    });
    expect(getClientIp(headers)).toBe('1.1.1.1');
  });
});

describe('RATE_LIMITS config', () => {
  it('has standard config (30/min)', () => {
    expect(RATE_LIMITS.standard.maxRequests).toBe(30);
    expect(RATE_LIMITS.standard.windowMs).toBe(60_000);
  });

  it('has auth config (5/min)', () => {
    expect(RATE_LIMITS.auth.maxRequests).toBe(5);
    expect(RATE_LIMITS.auth.windowMs).toBe(60_000);
  });

  it('has upload config (10/min)', () => {
    expect(RATE_LIMITS.upload.maxRequests).toBe(10);
    expect(RATE_LIMITS.upload.windowMs).toBe(60_000);
  });

  it('has strict config (3/min)', () => {
    expect(RATE_LIMITS.strict.maxRequests).toBe(3);
    expect(RATE_LIMITS.strict.windowMs).toBe(60_000);
  });
});

describe('checkRateLimitAsync (distributed adapter)', () => {
  it('is disabled when Upstash env vars are absent', () => {
    // No UPSTASH_REDIS_REST_URL/_TOKEN in the test env.
    expect(isDistributedRateLimitEnabled()).toBe(false);
  });

  it('falls back to the in-memory limiter and matches its semantics', async () => {
    const key = uniqueKey();
    const config = { maxRequests: 2, windowMs: 60_000 };
    expect((await checkRateLimitAsync(key, config)).allowed).toBe(true);
    expect((await checkRateLimitAsync(key, config)).allowed).toBe(true);
    const blocked = await checkRateLimitAsync(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('returns the standard result shape', async () => {
    const result = await checkRateLimitAsync(uniqueKey());
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('resetMs');
  });
});
