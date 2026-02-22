/**
 * Integration tests for secure/conversations and secure/conversations/read routes
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
  vi.mocked(secureGuard).mockResolvedValue(session as any);
  vi.mocked(isValidUUID).mockReturnValue(true);
});

describe('POST /api/secure/conversations', () => {
  let CONV_POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/conversations/route');
    CONV_POST = mod.POST;
  });

  it('returns 400 for invalid participant ID', async () => {
    vi.mocked(isValidUUID).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherId: 'not-uuid' }),
    });
    const res = await CONV_POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for self-conversation', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/secure/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherId: 'p1' }),
    });
    const res = await CONV_POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when blocked', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Block check - blocked  AND existing conversation check
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ count: 1, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherId: 'p2' }),
    });
    const res = await CONV_POST(req);
    expect(res.status).toBe(403);
  });

  it('returns existing conversation if found', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    const existingConv = { id: 'conv1', event_id: 'e1', a_participant_id: 'p1', b_participant_id: 'p2' };

    // Block check - not blocked
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });
    // Existing conversation found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingConv, error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherId: 'p2' }),
    });
    const res = await CONV_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('conv1');
  });

  it('creates new conversation if none exists', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Block check - not blocked
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });
    // No existing conversation
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // New conversation insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'conv-new', event_id: 'e1', a_participant_id: 'p1', b_participant_id: 'p2' },
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherId: 'p2' }),
    });
    const res = await CONV_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('conv-new');
  });

  it('I-CNV-06: no session → 401', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherId: 'p2' }),
    });
    const res = await CONV_POST(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/secure/conversations/read', () => {
  let READ_POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/secure/conversations/read/route');
    READ_POST = mod.POST;
  });

  it('returns 400 for invalid conversationId', async () => {
    vi.mocked(isValidUUID).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/conversations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'not-uuid' }),
    });
    const res = await READ_POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when not a participant', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Both a and b updates match 0 rows
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/conversations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: '10000000-1000-4000-8000-000000000001' }),
    });
    const res = await READ_POST(req);
    expect(res.status).toBe(403);
  });

  it('marks conversation as read successfully', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // a_participant update matches
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: 'conv1' }], error: null }),
    });
    // b_participant update doesn't match
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/conversations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: '10000000-1000-4000-8000-000000000001' }),
    });
    const res = await READ_POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
