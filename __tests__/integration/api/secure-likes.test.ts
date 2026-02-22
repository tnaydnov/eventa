/**
 * Integration tests for secure/likes and secure/likes/seen routes
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

import { secureGuard } from '@/lib/route-helpers';
import { isValidUUID } from '@/lib/session';

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  vi.mocked(secureGuard).mockResolvedValue(session as any);
  vi.mocked(isValidUUID).mockReturnValue(true);
});

describe('POST /api/secure/likes', () => {
  let LIKES_POST: (req: NextRequest) => Promise<Response>;
  let LIKES_DELETE: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/likes/route');
    LIKES_POST = mod.POST;
    LIKES_DELETE = mod.DELETE;
  });

  it('returns 400 for invalid participant ID', async () => {
    vi.mocked(isValidUUID).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'not-uuid' }),
    });
    const res = await LIKES_POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for self-like', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'p1' }), // same as session.sub
    });
    const res = await LIKES_POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when blocked', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Block check - blocked
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ count: 1, error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'p2' }),
    });
    const res = await LIKES_POST(req);
    expect(res.status).toBe(403);
  });

  it('creates like and checks for match', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Block check - not blocked
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });
    // Like insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'like1', from_participant_id: 'p1', to_participant_id: 'p2', created_at: '2025-01-01' },
        error: null,
      }),
    });
    // Reciprocal check - it's a match!
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'like2' }, error: null }),
    });
    // Activity log + notifications (fire-and-forget)
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'p2' }),
    });
    const res = await LIKES_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBe(true);
  });

  it('handles duplicate like (23505 code) gracefully', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Block check - not blocked
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });
    // Like insert - unique constraint violation
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      }),
    });
    // Fetch existing like
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'like1', event_id: 'e1', from_participant_id: 'p1', to_participant_id: 'p2', created_at: '2025-01-01', seen_at: null },
        error: null,
      }),
    });
    // Reciprocal check
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'p2' }),
    });
    const res = await LIKES_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBe(false);
  });

  it('I-LIK-07: no session → 401', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'p2' }),
    });
    const res = await LIKES_POST(req);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/secure/likes', () => {
  let LIKES_DELETE: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/likes/route');
    LIKES_DELETE = mod.DELETE;
  });

  it('deletes like and associated notification', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Like delete
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    });
    // Notification delete
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    });

    // The Promise.all resolves both
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/likes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: 'p2' }),
    });
    const res = await LIKES_DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('POST /api/secure/likes/seen', () => {
  let SEEN_POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/likes/seen/route');
    SEEN_POST = mod.POST;
  });

  it('marks specific like as seen', async () => {
    const chainObj: any = {
      update: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      then: vi.fn((cb: any) => Promise.resolve({ error: null }).then(cb)),
    };
    chainObj.update.mockReturnValue(chainObj);
    chainObj.eq.mockReturnValue(chainObj);
    chainObj.is.mockReturnValue(chainObj);
    mockFrom.mockReturnValueOnce(chainObj);

    const req = new NextRequest('http://localhost/api/secure/likes/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromParticipantId: '20000000-2000-4000-8000-000000000002' }),
    });
    const res = await SEEN_POST(req);
    expect(res.status).toBe(200);
  });

  it('marks all likes as seen', async () => {
    const chainObj: any = {
      update: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      then: vi.fn((cb: any) => Promise.resolve({ error: null }).then(cb)),
    };
    chainObj.update.mockReturnValue(chainObj);
    chainObj.eq.mockReturnValue(chainObj);
    chainObj.is.mockReturnValue(chainObj);
    mockFrom.mockReturnValueOnce(chainObj);

    const req = new NextRequest('http://localhost/api/secure/likes/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    const res = await SEEN_POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid body', async () => {
    const req = new NextRequest('http://localhost/api/secure/likes/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' }),
    });
    const res = await SEEN_POST(req);
    expect(res.status).toBe(400);
  });
});
