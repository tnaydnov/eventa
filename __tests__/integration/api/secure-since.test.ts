/**
 * Integration tests for GET /api/secure/since — consolidated polling-delta endpoint
 * (SECURITY_HARDENING_PLAN §23.4/R6).
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createQueryMock } from '../../helpers/supabase-mock';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({ getServiceClient: () => ({ from: mockFrom }) }));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { standard: { maxRequests: 30, windowMs: 60000 } },
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
    new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } })
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { secureGuard } from '@/lib/route-helpers';
import { GET } from '@/app/api/secure/since/route';

function req(cursor?: string) {
  const url = cursor
    ? `http://localhost/api/secure/since?cursor=${encodeURIComponent(cursor)}`
    : 'http://localhost/api/secure/since';
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(secureGuard).mockResolvedValue(session as never);
});

describe('GET /api/secure/since', () => {
  it('returns the guard response when secureGuard rejects', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as never,
    );
    const res = await GET(req('2026-06-12T00:00:00Z'));
    expect(res.status).toBe(401);
  });

  it('returns likes, messages, membership, unseen senders and serverNow', async () => {
    mockFrom
      // likes (new)
      .mockReturnValueOnce(createQueryMock({ data: [{ id: 'l1', from_participant_id: 'p2', created_at: '2026-06-12T01:00:00Z' }], error: null }))
      // conversations (membership)
      .mockReturnValueOnce(createQueryMock({ data: [{ id: 'c1' }, { id: 'c2' }], error: null }))
      // unseen likes (reconcile)
      .mockReturnValueOnce(createQueryMock({ data: [{ from_participant_id: 'p2' }], error: null }))
      // messages (because membership is non-empty)
      .mockReturnValueOnce(createQueryMock({ data: [{ id: 'm1', sender_participant_id: 'p2', conversation_id: 'c1', text: 'hi', type: 'text', created_at: '2026-06-12T02:00:00Z' }], error: null }));

    const res = await GET(req('2026-06-12T00:00:00Z'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.likes).toHaveLength(1);
    expect(body.messages).toHaveLength(1);
    expect(body.myConversationIds).toEqual(['c1', 'c2']);
    expect(body.unseenLikeSenders).toEqual(['p2']);
    expect(typeof body.serverNow).toBe('string');
  });

  it('skips the messages query when the participant has no conversations', async () => {
    mockFrom
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))       // likes
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))       // conversations (empty)
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }));      // unseen

    const res = await GET(req('2026-06-12T00:00:00Z'));
    const body = await res.json();
    expect(body.messages).toEqual([]);
    expect(body.myConversationIds).toEqual([]);
    // Only 3 queries ran (no messages query) — confirms the membership short-circuit.
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it('returns 500 when the likes query errors', async () => {
    mockFrom
      .mockReturnValueOnce(createQueryMock({ data: null, error: { message: 'db down' } })) // likes error
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }));
    const res = await GET(req('2026-06-12T00:00:00Z'));
    expect(res.status).toBe(500);
  });

  it('signals unseenLikeSenders=null when the unseen query errors (client must not reconcile)', async () => {
    mockFrom
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))                       // likes
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))                       // conversations
      .mockReturnValueOnce(createQueryMock({ data: null, error: { message: 'oops' } }));    // unseen error
    const res = await GET(req('2026-06-12T00:00:00Z'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.unseenLikeSenders).toBeNull();
  });

  it('tolerates a missing/invalid cursor (establishes a baseline, no error)', async () => {
    mockFrom
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }))
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }));
    const res = await GET(req('not-a-date'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.serverNow).toBe('string');
  });
});
