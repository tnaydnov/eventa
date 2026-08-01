/**
 * IDOR / cross-event authorization tests (SECURITY_HARDENING_PLAN §6, §21).
 *
 * Verifies that a secure route refuses to act on objects the caller does not own,
 * even with a valid session - i.e. horizontal privilege escalation is blocked. Uses
 * the photo-delete route as the representative case: it looks the object up scoped to
 * the session's event and rejects when the owner doesn't match the session participant.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createQueryMock } from '../../helpers/supabase-mock';

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => unknown) => { void fn; } };
});

const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: mockFrom,
    storage: { from: vi.fn().mockReturnValue({ remove: mockStorageRemove }) },
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 14, resetMs: 60000 }),
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 14, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { standard: { maxRequests: 30, windowMs: 60000 }, upload: { maxRequests: 15, windowMs: 60000 } },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  getSessionFromRequest: vi.fn().mockReturnValue(null),
  isValidUUID: vi.fn().mockReturnValue(true),
}));

// Authenticated as participant 'p1' in event 'e1'.
const session = vi.hoisted(() => ({
  sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
  iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
}));

vi.mock('@/lib/route-helpers', () => ({
  secureGuard: vi.fn().mockResolvedValue(session),
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } })
  ),
  isSafePath: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { DELETE } from '@/app/api/secure/photos/route';

function delReq(photoId: string) {
  return new NextRequest('http://localhost/api/secure/photos', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ photoId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageRemove.mockResolvedValue({ error: null });
});

describe('IDOR: secure/photos DELETE ownership enforcement', () => {
  it('blocks deleting a photo owned by a DIFFERENT participant (403)', async () => {
    // Lookup (scoped to event e1) returns a photo owned by p2 - not the caller p1.
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { participant_id: 'p2', storage_path: 'e1/p2/photo.webp' }, error: null,
    }));

    const res = await DELETE(delReq('11111111-1111-4111-8111-111111111111'));
    expect(res.status).toBe(403);
    // Critically: no delete/storage-removal was attempted on someone else's object.
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledTimes(1); // only the ownership lookup ran
  });

  it('blocks deleting a photo from a DIFFERENT event (lookup is event-scoped → 403)', async () => {
    // The route filters by .eq('event_id', session.eid); a photo in another event
    // is simply not found, yielding null → Forbidden.
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const res = await DELETE(delReq('22222222-2222-4222-8222-222222222222'));
    expect(res.status).toBe(403);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('allows deleting the caller’s OWN photo (200) - confirms the 403s are not false positives', async () => {
    mockFrom
      .mockReturnValueOnce(createQueryMock({
        data: { participant_id: 'p1', storage_path: 'e1/p1/photo.webp' }, error: null,
      })) // ownership lookup: owned by caller
      .mockReturnValueOnce(createQueryMock({ data: null, error: null })); // delete

    const res = await DELETE(delReq('33333333-3333-4333-8333-333333333333'));
    expect(res.status).toBe(200);
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
  });
});
