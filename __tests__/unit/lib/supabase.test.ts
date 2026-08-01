/**
 * Unit tests for lib/supabase.ts - Supabase client, generateJoinCode, setEventContext
 * Tests: U-SUP-01 through U-SUP-06+
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js before importing
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    auth: {},
  })),
}));

describe('generateJoinCode', () => {
  let generateJoinCode: typeof import('@/lib/supabase').generateJoinCode;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/supabase');
    generateJoinCode = mod.generateJoinCode;
  });

  it('U-SUP-01: returns a 6-character alphanumeric string', () => {
    const code = generateJoinCode();
    expect(code).toMatch(/^[a-z0-9]{6}$/);
    expect(code.length).toBe(6);
  });

  it('U-SUP-02: generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateJoinCode()));
    expect(codes.size).toBe(100);
  });

  it('U-SUP-03: contains only lowercase alphanumeric chars', () => {
    const code = generateJoinCode();
    expect(code).toMatch(/^[a-z0-9]+$/);
    expect(code).not.toMatch(/[A-Z]/);
  });
});

describe('setEventContext', () => {
  let setEventContext: typeof import('@/lib/supabase').setEventContext;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/supabase');
    setEventContext = mod.setEventContext;
  });

  it('U-SUP-04: does not throw', () => {
    expect(() => setEventContext('event-123')).not.toThrow();
  });

  it('U-SUP-05: accepts UUID-like strings', () => {
    expect(() => setEventContext('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
  });

  it('U-SUP-06: can set and clear', () => {
    setEventContext('event-123');
    setEventContext('');
    // No assertion beyond no-throw
  });
});

describe('getServiceClient', () => {
  let getServiceClient: typeof import('@/lib/supabase').getServiceClient;

  beforeEach(async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    vi.resetModules();
    const mod = await import('@/lib/supabase');
    getServiceClient = mod.getServiceClient;
  });

  it('returns a client object', () => {
    const client = getServiceClient();
    expect(client).toBeTruthy();
    expect(typeof client).toBe('object');
  });

  it('returns the same singleton', () => {
    const client1 = getServiceClient();
    const client2 = getServiceClient();
    expect(client1).toBe(client2);
  });
});
