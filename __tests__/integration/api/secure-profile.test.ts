/**
 * Integration tests for secure/profile, secure/heartbeat routes
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
    upload: { maxRequests: 15, windowMs: 60000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  getSessionFromRequest: vi.fn().mockReturnValue(null),
  isValidUUID: vi.fn().mockReturnValue(true),
}));

const sessionPayload = vi.hoisted(() => ({
  sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
  iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
}));

vi.mock('@/lib/route-helpers', () => ({
  secureGuard: vi.fn().mockResolvedValue(sessionPayload),
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  isSafePath: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeWithLimit: vi.fn((text: string, limit: number) => text.slice(0, limit)),
}));

vi.mock('@/lib/constants', () => ({
  MAX_NAME_LENGTH: 30,
  MAX_BIO_LENGTH: 500,
  MAX_CITY_LENGTH: 50,
  MAX_PHOTOS: 6,
  MAX_MESSAGE_LENGTH: 1000,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { secureGuard } from '@/lib/route-helpers';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(secureGuard).mockResolvedValue(sessionPayload as any);
});

describe('PATCH /api/secure/profile', () => {
  let PATCH: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/profile/route');
    PATCH = mod.PATCH;
  });

  it('returns guard response when unauthorized', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Test' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty update', async () => {
    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('updates profile successfully', async () => {
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'p1', display_name: 'NewName', gender: 'male' }],
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'NewName' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('NewName');
  });

  it('returns 404 when update matches 0 rows', async () => {
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Test' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it('I-PRF-02: display_name is sanitized through sanitizeWithLimit', async () => {
    const { sanitizeWithLimit } = await import('@/lib/sanitize');

    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'p1', display_name: 'Clean' }],
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: '<script>xss</script>Name' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(sanitizeWithLimit).toHaveBeenCalled();
  });

  it('I-PRF-03: bio is sanitized through sanitizeWithLimit', async () => {
    const { sanitizeWithLimit } = await import('@/lib/sanitize');

    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'p1', bio: 'clean bio' }],
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: '<img src=x onerror=alert(1)>Bio' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(sanitizeWithLimit).toHaveBeenCalled();
  });

  it('I-PRF-05: invalid gender value → 400', async () => {
    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender: 'alien' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('I-PRF-06: age out of range → 400', async () => {
    const req = new NextRequest('http://localhost/api/secure/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age: 5 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/secure/heartbeat', () => {
  let HEARTBEAT_POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/heartbeat/route');
    HEARTBEAT_POST = mod.POST;
  });

  it('returns 200 on successful heartbeat', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { last_seen_at: new Date(Date.now() - 5 * 60000).toISOString() },
        error: null,
      }),
    });
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/heartbeat', { method: 'POST' });
    const res = await HEARTBEAT_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns guard response when unauthorized', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/heartbeat', { method: 'POST' });
    const res = await HEARTBEAT_POST(req);
    expect(res.status).toBe(401);
  });
});
