/**
 * Integration tests for POST /api/admin/logout
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
  },
}));

vi.mock('@/lib/admin-auth', () => ({
  clearAdminCookieHeader: vi.fn().mockReturnValue('ws_admin=; Path=/; Max-Age=0'),
}));

import { POST } from '@/app/api/admin/logout/route';
import { checkRateLimit } from '@/lib/rate-limit';

function makeReq() {
  return new NextRequest('http://localhost/api/admin/logout', { method: 'POST' });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 });
});

describe('POST /api/admin/logout', () => {
  it('returns 200 and clears admin cookie', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.headers.get('Set-Cookie')).toContain('ws_admin');
  });

  it('I-ADM-LGT-02: succeeds even without existing cookie', async () => {
    // Logout is idempotent - always returns success & sets clearing cookie
    const req = new NextRequest('http://localhost/api/admin/logout', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });
});
