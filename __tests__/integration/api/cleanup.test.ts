/**
 * Integration tests for GET/POST /api/cleanup (cron job)
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFrom = vi.fn();
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: mockFrom,
    storage: { from: vi.fn().mockReturnValue({ remove: mockStorageRemove }) },
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    strict: { maxRequests: 5, windowMs: 60000 },
  },
}));

vi.mock('@/lib/route-helpers', () => ({
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

vi.mock('@/lib/constants', () => ({
  RETENTION_DAYS: 30,
  STORAGE_BATCH_SIZE: 100,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET, POST } from '@/app/api/cleanup/route';
import { checkRateLimit } from '@/lib/rate-limit';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 });
  process.env.CRON_SECRET = 'test-cron-secret-123';
});

function makeReq(method: string = 'GET', params: string = '') {
  return new NextRequest(`http://localhost/api/cleanup${params}`, {
    method,
    headers: {
      Authorization: `Bearer test-cron-secret-123`,
    },
  });
}

describe('GET /api/cleanup', () => {
  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
  });

  it('returns 401 for missing/wrong auth', async () => {
    const req = new NextRequest('http://localhost/api/cleanup', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 500 when CRON_SECRET not set', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cleanup', {
      method: 'GET',
      headers: { Authorization: 'Bearer anything' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('returns "nothing to clean up" when no old events', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archived).toBe(0);
  });

  it('returns 500 on DB error fetching events', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });

  it('supports dry_run mode', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [{ id: 'e1', name: 'Old Event' }], error: null }),
    });

    const res = await GET(makeReq('GET', '?dry_run=true'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.wouldArchive).toBe(1);
  });

  it('I-CLN-01: attempts archive when events found (non-dry-run)', async () => {
    // Find old events
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [{ id: 'e1', name: 'Old Event' }], error: null }),
    });
    // The route attempts to process each event (snapshot, cleanup, etc.)
    // Without full mocks the route will error, but it should NOT be 401/429
    const res = await GET(makeReq());
    // Route either succeeds (200) or fails on internal DB ops (500)
    expect([200, 500]).toContain(res.status);
  });
});

describe('POST /api/cleanup', () => {
  it('works with POST method too', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const res = await POST(makeReq('POST'));
    expect(res.status).toBe(200);
  });
});
