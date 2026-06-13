/**
 * Integration tests for /api/health
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock supabase
const mockSelect = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}));

// Mock rate limit (allow by default)
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 19, resetMs: 60000 }),
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 19, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import { GET } from '@/app/api/health/route';
import { checkRateLimit } from '@/lib/rate-limit';

let fakeNow = 100_000;
beforeEach(() => {
  vi.clearAllMocks();
  // Advance time past 5s cache TTL to ensure fresh DB query each test
  fakeNow += 10_000;
  vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 19, resetMs: 60000 });
  mockSelect.mockResolvedValue({ error: null });
});

describe('GET /api/health', () => {
  it('returns 200 with ok status when DB is reachable', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.latency).toBeDefined();
  });

  it('returns 503 on DB error', async () => {
    mockSelect.mockResolvedValue({ error: { message: 'Connection refused' } });
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    expect(res.status).toBe(429);
  });

  it('I-HLT-03: returns cached response within 5s TTL', async () => {
    // First call → fresh DB query → 200
    const req1 = new NextRequest('http://localhost/api/health');
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    // Second call within 5s → should be cached (even if DB mock changes)
    mockSelect.mockResolvedValue({ error: { message: 'Should not be called' } });
    // Don't advance time → within TTL
    const req2 = new NextRequest('http://localhost/api/health');
    const res2 = await GET(req2);
    expect(res2.status).toBe(200); // cached 200, not 503
  });

  it('returns 503 on exception', async () => {
    mockSelect.mockRejectedValue(new Error('timeout'));
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('error');
  });
});
