/**
 * Integration tests for POST /api/account/delete
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });
const mockStorage = { from: vi.fn().mockReturnValue({ remove: mockStorageRemove }) };

/** Reusable Supabase-like chain object (all methods return `this`, await resolves to success). */
function makeChain(overrides: Record<string, unknown> = {}): any {
  const chain: any = {};
  const methods = ['select', 'delete', 'insert', 'update', 'eq', 'or', 'in', 'not', 'single', 'maybeSingle', 'order', 'limit', 'is'];
  for (const m of methods) {
    chain[m] = vi.fn();
  }
  // Default: all methods return chain itself (for chaining)
  for (const m of methods) {
    chain[m].mockReturnValue(chain);
  }
  // Make it thenable so `await supabase.from(...).delete().eq(...)` works
  chain.then = (resolve: Function) => resolve({ data: null, error: null });
  // single/maybeSingle return promises
  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  // Apply overrides
  Object.assign(chain, overrides);
  return chain;
}

let fromCallIndex: number;
let fromCallOverrides: Record<number, any>;
const mockFrom = vi.fn().mockImplementation(() => {
  const idx = fromCallIndex++;
  if (fromCallOverrides[idx]) return fromCallOverrides[idx];
  return makeChain();
});

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom, storage: mockStorage }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 }),
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
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
  clearSessionCookieHeader: vi.fn().mockReturnValue('ws_session=; Path=/; Max-Age=0'),
}));

vi.mock('@/lib/route-helpers', () => ({
  secureGuard: vi.fn().mockResolvedValue({
    sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
    iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
  }),
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

vi.mock('@/lib/constants', () => ({
  STORAGE_BATCH_SIZE: 100,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
}));

import { POST } from '@/app/api/account/delete/route';
import { secureGuard } from '@/lib/route-helpers';

function makeReq() {
  return new NextRequest('http://localhost/api/account/delete', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  fromCallIndex = 0;
  fromCallOverrides = {};
  vi.mocked(secureGuard).mockResolvedValue({
    sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
    iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
  } as any);
});

describe('POST /api/account/delete', () => {
  it('returns guard response when secureGuard rejects', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 404 when participant not found', async () => {
    // Call 0: pre-check - participant not found
    fromCallOverrides[0] = makeChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
  });

  it('completes cascade delete successfully', async () => {
    // Call 0: pre-check participant exists (route uses .maybeSingle())
    fromCallOverrides[0] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    });
    // Call 4: selfParticipant fingerprint lookup → none (skip banned_devices)
    fromCallOverrides[4] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // Final call: participants soft-delete update → success (default chain)
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });

  it('returns 500 when final participant delete fails', async () => {
    // Call 0: pre-check - participant exists
    fromCallOverrides[0] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    });
    // Call 4: no fingerprints → skip banned_devices
    fromCallOverrides[4] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // Call 5: participants soft-delete update → FAILS
    const failChain = makeChain();
    failChain.then = (resolve: Function) => resolve({ data: null, error: { message: 'delete failed' } });
    fromCallOverrides[5] = failChain;

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it('I-DEL-02: deletes photos from storage', async () => {
    fromCallOverrides[0] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    });
    // Call 1: fetch photos → has photo paths
    const photosChain = makeChain();
    photosChain.then = (resolve: Function) => resolve({
      data: [{ storage_path: 'e1/p1/photo1.jpg' }, { storage_path: 'e1/p1/photo2.jpg' }],
      error: null,
    });
    fromCallOverrides[1] = photosChain;
    // Call 4: no fingerprints
    fromCallOverrides[4] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockStorageRemove).toHaveBeenCalled();
    const removedPaths = mockStorageRemove.mock.calls[0][0];
    expect(removedPaths).toContain('e1/p1/photo1.jpg');
  });

  it('I-DEL-11: clears session cookie in response', async () => {
    fromCallOverrides[0] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    });
    fromCallOverrides[4] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
  });

  it('I-DEL-08: cleans up banned_devices entries', async () => {
    fromCallOverrides[0] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    });
    // Call 4: device fingerprints found
    fromCallOverrides[4] = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { device_fingerprint: 'fp1', hardware_fingerprint: 'hw1' },
        error: null,
      }),
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    // Verify banned_devices was queried for cleanup
    const fromCalls = mockFrom.mock.calls.map((c: any) => c[0]);
    expect(fromCalls).toContain('banned_devices');
  });
});
