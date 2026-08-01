/**
 * Integration tests for secure/messages route (POST, PATCH)
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
  // Async (distributed) limiter - routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 }),
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
  isSafePath: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeWithLimit: vi.fn((text: string, limit: number) => text.slice(0, limit)),
}));

vi.mock('@/lib/constants', () => ({
  MAX_MESSAGE_LENGTH: 1000,
  MAX_NAME_LENGTH: 30,
  MAX_BIO_LENGTH: 500,
  MAX_CITY_LENGTH: 50,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST, PATCH } from '@/app/api/secure/messages/route';
import { secureGuard } from '@/lib/route-helpers';
import { isValidUUID } from '@/lib/session';
import { createQueryMock } from '../../helpers/supabase-mock';

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  vi.mocked(secureGuard).mockResolvedValue(session as any);
  vi.mocked(isValidUUID).mockReturnValue(true);
});

describe('POST /api/secure/messages', () => {
  it('returns 400 for invalid message data', async () => {
    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when sender is not in conversation', async () => {
    // Conversation lookup - user NOT a participant
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { a_participant_id: 'other1', b_participant_id: 'other2' },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: 'Hello',
        type: 'text',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when blocked', async () => {
    // Conversation lookup - user IS a participant
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { a_participant_id: 'p1', b_participant_id: 'p2' },
      error: null,
    }));
    // Block check - blocked
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 1 }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: 'Hello',
        type: 'text',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for empty text message', async () => {
    // Conversation lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { a_participant_id: 'p1', b_participant_id: 'p2' },
      error: null,
    }));
    // Block check - not blocked
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 0 }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: '',
        type: 'text',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('sends message successfully', async () => {
    // Conversation lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { a_participant_id: 'p1', b_participant_id: 'p2' },
      error: null,
    }));
    // Block check - not blocked
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 0 }));
    // Conversation timestamp update
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    // Message insert
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'msg1', text: 'Hello', type: 'text', sender_participant_id: 'p1' },
      error: null,
    }));
    // Activity log + notification (fire-and-forget)
    mockFrom.mockReturnValue(createQueryMock({ data: null, error: null }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: 'Hello',
        type: 'text',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('I-MSG-04: text is sanitized (XSS stripped)', async () => {
    const { sanitizeWithLimit } = await import('@/lib/sanitize');
    // Conversation lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { a_participant_id: 'p1', b_participant_id: 'p2' },
      error: null,
    }));
    // Block check
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 0 }));
    // Conversation timestamp update
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    // Message insert
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'msg1', text: 'safe', type: 'text', sender_participant_id: 'p1' },
      error: null,
    }));
    mockFrom.mockReturnValue(createQueryMock({ data: null, error: null }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: '<script>alert(1)</script>Hello',
        type: 'text',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sanitizeWithLimit).toHaveBeenCalled();
  });

  it('I-MSG-09: conversation does not exist → 403', async () => {
    // Conversation lookup returns null data (no matching row)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: 'Hello',
        type: 'text',
      }),
    });
    const res = await POST(req);
    // Route returns 403 for nonexistent conversations (intentionally obscures existence)
    expect(res.status).toBe(403);
  });

  it('I-MSG-11: no session → 401', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: '10000000-1000-4000-8000-000000000001',
        text: 'Hello',
        type: 'text',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/secure/messages (soft delete)', () => {
  it('returns 400 for invalid message ID', async () => {
    vi.mocked(isValidUUID).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'not-uuid' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when trying to delete someone elses message', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { sender_participant_id: 'other-person' },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: '10000000-1000-4000-8000-000000000001' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it('soft deletes own message', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Message lookup - sender matches
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { sender_participant_id: 'p1' },
      error: null,
    }));
    // Soft delete update
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const req = new NextRequest('http://localhost/api/secure/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: '10000000-1000-4000-8000-000000000001' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
