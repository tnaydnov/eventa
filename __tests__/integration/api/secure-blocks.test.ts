/**
 * Integration tests for secure/blocks route
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: mockFrom,
    storage: { from: vi.fn().mockReturnValue({ remove: mockStorageRemove }) },
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 }),
  // Async (distributed) limiter - routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    strict: { maxRequests: 5, windowMs: 60000 },
    standard: { maxRequests: 30, windowMs: 60000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  getSessionFromRequest: vi.fn().mockReturnValue(null),
  isValidUUID: vi.fn().mockReturnValue(true),
}));

const session = vi.hoisted(() => ({
  sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
  iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
}));

vi.mock('@/lib/route-helpers', () => ({
  secureGuard: vi.fn().mockResolvedValue(session),
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/secure/blocks/route';
import { secureGuard } from '@/lib/route-helpers';
import { isValidUUID } from '@/lib/session';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(secureGuard).mockResolvedValue(session as any);
  vi.mocked(isValidUUID).mockReturnValue(true);
});

describe('POST /api/secure/blocks', () => {
  it('returns 400 for invalid blockedId', async () => {
    vi.mocked(isValidUUID).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: 'not-uuid' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for self-block', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: 'p1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('blocks user and cascades', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);

    // Context checks (like forward, like reverse, convo) - 3 parallel queries
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'l1' }, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'conv1' }, error: null }),
    });

    // Block insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    // Activity log
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    // Cascade deletes (4 parallel)
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: 'p2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 idempotently on duplicate block', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);

    // Context checks
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Block insert - duplicate (23505)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } }),
    });

    const req = new NextRequest('http://localhost/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: 'p2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns guard response when unauthorized', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: 'p2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
