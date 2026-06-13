/**
 * Integration tests for /api/auth/verify
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
    auth: { maxRequests: 10, windowMs: 300000 },
  },
}));

vi.mock('@/lib/session', () => ({
  getSessionFromRequest: vi.fn().mockReturnValue(null),
  clearSessionCookieHeader: vi.fn().mockReturnValue('ws_session=; Path=/; Max-Age=0'),
  checkCsrf: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/route-helpers', () => ({
  jsonError: vi.fn((message: string, status: number) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET, DELETE } from '@/app/api/auth/verify/route';
import { getSessionFromRequest, checkCsrf } from '@/lib/session';
import { checkRateLimit, checkRateLimitAsync } from '@/lib/rate-limit';
import { createQueryMock } from '../../helpers/supabase-mock';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 });
  vi.mocked(checkRateLimitAsync).mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 });
  vi.mocked(getSessionFromRequest).mockReturnValue(null);
  vi.mocked(checkCsrf).mockReturnValue(true);
});

describe('GET /api/auth/verify', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getSessionFromRequest).mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    vi.mocked(checkRateLimitAsync).mockResolvedValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(429);
  });

  it('returns 403 when participant is banned', async () => {
    vi.mocked(getSessionFromRequest).mockReturnValue({
      sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test Event',
      iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
    });

    mockFrom.mockReturnValueOnce(createQueryMock({ data: { is_banned: true }, error: null }));

    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns session data for valid non-banned participant with active event', async () => {
    vi.mocked(getSessionFromRequest).mockReturnValue({
      sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test Event',
      iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
    });

    // participant lookup
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { is_banned: false }, error: null }));

    // event lookup
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { status: 'active', is_active: true }, error: null }));

    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participantId).toBe('p1');
    expect(body.eventSlug).toBe('test-event');
  });

  it('returns 410 for paused event', async () => {
    vi.mocked(getSessionFromRequest).mockReturnValue({
      sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
      iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
    });

    mockFrom.mockReturnValueOnce(createQueryMock({ data: { is_banned: false }, error: null }));

    mockFrom.mockReturnValueOnce(createQueryMock({ data: { status: 'paused', is_active: false }, error: null }));

    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(410);
  });

  it('I-VER-03: returns 401 for expired/invalid session token', async () => {
    // getSessionFromRequest returns null for expired tokens
    vi.mocked(getSessionFromRequest).mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 410 for archived event', async () => {
    vi.mocked(getSessionFromRequest).mockReturnValue({
      sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
      iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
    });

    mockFrom.mockReturnValueOnce(createQueryMock({ data: { is_banned: false }, error: null }));

    mockFrom.mockReturnValueOnce(createQueryMock({ data: { status: 'archived', is_active: false }, error: null }));

    const req = new NextRequest('http://localhost/api/auth/verify');
    const res = await GET(req);
    expect(res.status).toBe(410);
  });
});

describe('DELETE /api/auth/verify', () => {
  it('clears session cookie', async () => {
    vi.mocked(checkCsrf).mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/auth/verify', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 403 when CSRF check fails', async () => {
    vi.mocked(checkCsrf).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/auth/verify', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });
});
