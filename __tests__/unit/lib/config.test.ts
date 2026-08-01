/**
 * Unit tests for lib/config.ts - Application configuration constants
 * Tests: U-CFG-01 through U-CFG-07+
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  SESSION_MAX_AGE_S,
  ADMIN_MAX_AGE_S,
  JWT_ISSUER,
  JWT_AUDIENCE,
  BAN_CACHE_TTL_MS,
  BAN_CACHE_TTL_BANNED_MS,
  EVENT_STATUS_CACHE_TTL_ACTIVE_MS,
  EVENT_STATUS_CACHE_TTL_INACTIVE_MS,
  MAX_CACHE_SIZE,
  ORDER_NAME_MAX_LENGTH,
  ORDER_PHONE_MAX_LENGTH,
  ORDER_EMAIL_MAX_LENGTH,
} from '@/lib/config';

describe('config constants', () => {
  it('U-CFG-01: SESSION_MAX_AGE_S is 30 days', () => {
    expect(SESSION_MAX_AGE_S).toBe(30 * 24 * 60 * 60);
  });

  it('U-CFG-02: ADMIN_MAX_AGE_S is 24 hours', () => {
    expect(ADMIN_MAX_AGE_S).toBe(24 * 60 * 60);
  });

  it('U-CFG-03: JWT_ISSUER is derived from the configured site host', () => {
    expect(JWT_ISSUER).toBe('test.example.com');
  });

  it('U-CFG-04: JWT_AUDIENCE is eventa-app', () => {
    expect(JWT_AUDIENCE).toBe('eventa-app');
  });

  it('U-CFG-05: BAN_CACHE_TTL_MS is 5 minutes', () => {
    expect(BAN_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('U-CFG-06: BAN_CACHE_TTL_BANNED_MS is 10 seconds', () => {
    expect(BAN_CACHE_TTL_BANNED_MS).toBe(10_000);
  });

  it('U-CFG-07: EVENT_STATUS_CACHE_TTL_ACTIVE_MS is 5 minutes', () => {
    expect(EVENT_STATUS_CACHE_TTL_ACTIVE_MS).toBe(5 * 60 * 1000);
  });

  it('EVENT_STATUS_CACHE_TTL_INACTIVE_MS is 30 seconds', () => {
    expect(EVENT_STATUS_CACHE_TTL_INACTIVE_MS).toBe(30_000);
  });

  it('MAX_CACHE_SIZE is 5000', () => {
    expect(MAX_CACHE_SIZE).toBe(5_000);
  });

  it('ORDER_NAME_MAX_LENGTH is 100', () => {
    expect(ORDER_NAME_MAX_LENGTH).toBe(100);
  });

  it('ORDER_PHONE_MAX_LENGTH is 30', () => {
    expect(ORDER_PHONE_MAX_LENGTH).toBe(30);
  });

  it('ORDER_EMAIL_MAX_LENGTH is 254', () => {
    expect(ORDER_EMAIL_MAX_LENGTH).toBe(254);
  });

  it('all values are positive numbers', () => {
    const values = [
      SESSION_MAX_AGE_S, ADMIN_MAX_AGE_S, BAN_CACHE_TTL_MS,
      BAN_CACHE_TTL_BANNED_MS, EVENT_STATUS_CACHE_TTL_ACTIVE_MS,
      EVENT_STATUS_CACHE_TTL_INACTIVE_MS, MAX_CACHE_SIZE,
      ORDER_NAME_MAX_LENGTH, ORDER_PHONE_MAX_LENGTH, ORDER_EMAIL_MAX_LENGTH,
    ];
    for (const v of values) {
      expect(v).toBeGreaterThan(0);
      expect(typeof v).toBe('number');
    }
  });

  it('all string values are non-empty', () => {
    expect(JWT_ISSUER.length).toBeGreaterThan(0);
    expect(JWT_AUDIENCE.length).toBeGreaterThan(0);
  });
});
