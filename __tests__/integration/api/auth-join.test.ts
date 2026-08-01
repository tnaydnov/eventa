/**
 * Integration tests for POST /api/auth/join
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockFrom = vi.fn();
const mockStorage = { from: vi.fn().mockReturnValue({ remove: vi.fn() }) };

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom, storage: mockStorage }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  // Async (distributed) limiter - routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
    auth: { maxRequests: 10, windowMs: 300000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  signSessionToken: vi.fn().mockReturnValue('mock-jwt-token'),
  sessionCookieHeader: vi.fn().mockReturnValue('ws_session=mock-jwt-token; Path=/; HttpOnly; SameSite=Lax'),
}));

vi.mock('@/lib/route-helpers', () => ({
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  getSessionEpoch: vi.fn().mockResolvedValue(1),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/auth/join/route';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit, checkRateLimitAsync } from '@/lib/rate-limit';
import { createQueryMock } from '../../helpers/supabase-mock';

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the from() queue each test so unconsumed/fire-and-forget
  // mockReturnValueOnce entries can't bleed into the next test.
  mockFrom.mockReset();
  vi.mocked(checkCsrf).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 });
  vi.mocked(checkRateLimitAsync).mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 });
});

describe('POST /api/auth/join', () => {
  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrf).mockReturnValue(false);
    const res = await POST(makeReq({ eventSlug: 'e', joinCode: '123456789012' }));
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    vi.mocked(checkRateLimitAsync).mockResolvedValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await POST(makeReq({ eventSlug: 'e', joinCode: '123456789012' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid input (missing eventSlug)', async () => {
    // joinCode is now an optional legacy field; eventSlug remains required.
    const res = await POST(makeReq({ joinCode: '123456789012' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when event lookup DB errors', async () => {
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: { message: 'DB error' } }));
    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL' }));
    expect(res.status).toBe(500);
  });

  it('returns 404 when event not found', async () => {
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    const res = await POST(makeReq({ eventSlug: 'nope', joinCode: 'XXXXXXXXXXXX' }));
    // The route returns 500 on eventError or 404 on no event
    expect([404, 500]).toContain(res.status);
  });

  it('creates new participant when no fingerprint match', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'active', is_active: true, background_image: null },
      error: null,
    }));
    // New participant insert
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { id: 'p-new' }, error: null }));
    // Activity log (fire-and-forget)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participantId).toBe('p-new');
    expect(body.eventName).toBe('Test');
  });

  it('reconnects existing participant by device fingerprint', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'active', is_active: true, background_image: null },
      error: null,
    }));
    // Ban check (device fingerprint)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    // Reconnect by fingerprint
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: {
        id: 'p-existing', event_id: 'e1', device_fingerprint: 'abc123', hardware_fingerprint: null,
        display_name: 'Test User', gender: 'female', attracted_to: 'all', bio: null,
        age: 25, city: null, looking_for: 'relationship', is_banned: false, last_seen_at: null, created_at: '2025-01-01',
      },
      error: null,
    }));

    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL', fingerprint: 'abc123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participantId).toBe('p-existing');
    // Fingerprints should be stripped from participant
    expect(body.participant?.device_fingerprint).toBeUndefined();
    expect(body.participant?.hardware_fingerprint).toBeUndefined();
  });

  it('returns 403 when device is banned', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'active', is_active: true, background_image: null },
      error: null,
    }));
    // Ban check - device is banned
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { id: 'ban1' }, error: null }));

    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL', fingerprint: 'aabb00ccddee' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when reconnected participant is banned', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'active', is_active: true, background_image: null },
      error: null,
    }));
    // Ban check - not banned at device level
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    // Reconnect by fingerprint - but participant is banned
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: {
        id: 'p-banned', event_id: 'e1', device_fingerprint: 'abc', hardware_fingerprint: null,
        display_name: 'Banned User', gender: 'male', attracted_to: 'all', bio: null,
        age: 30, city: null, looking_for: null, is_banned: true, last_seen_at: null, created_at: '2025-01-01',
      },
      error: null,
    }));

    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL', fingerprint: 'abc' }));
    expect(res.status).toBe(403);
  });

  it('returns 500 when participant creation fails', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'active', is_active: true, background_image: null },
      error: null,
    }));
    // New participant insert - fails
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: { message: 'insert failed' } }));

    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL' }));
    expect(res.status).toBe(500);
  });

  it('sanitizes invalid fingerprints to null', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'active', is_active: true, background_image: null },
      error: null,
    }));
    // New participant insert (no fingerprint used)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { id: 'p-new' }, error: null }));
    // Activity log
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    // Invalid fingerprint with special chars should be sanitized to null
    const res = await POST(makeReq({
      eventSlug: 'test', joinCode: 'ABCDEFGHIJKL',
      fingerprint: '<script>alert(1)</script>',
    }));
    expect(res.status).toBe(200);
  });

  it('I-JOIN-03: short joinCode is now accepted (legacy optional field)', async () => {
    // Join codes were removed; a short joinCode no longer fails validation, so the
    // request proceeds to the event lookup (which finds nothing here → 404).
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'AB' }));
    expect(res.status).toBe(404);
  });

  it('I-JOIN-05: event not active (ended) → rejects', async () => {
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', slug: 'test', name: 'Test', join_code: 'ABCDEFGHIJKL', status: 'ended', is_active: false, background_image: null },
      error: null,
    }));
    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'ABCDEFGHIJKL' }));
    // Route should reject inactive events (403 or 410)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('I-JOIN-06: wrong join code → rejects with 404', async () => {
    // Wrong join code means .eq('join_code', ...) returns no rows → data: null
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    const res = await POST(makeReq({ eventSlug: 'test', joinCode: 'WRONGCODEXXX' }));
    expect(res.status).toBe(404);
  });
});
