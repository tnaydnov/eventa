/**
 * Integration tests for POST /api/admin/login
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 300000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    auth: { maxRequests: 10, windowMs: 300000 },
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
  },
}));

vi.mock('@/lib/admin-auth', () => ({
  signAdminToken: vi.fn().mockReturnValue('admin-jwt'),
  adminCookieHeader: vi.fn().mockReturnValue('ws_admin=admin-jwt; Path=/; HttpOnly'),
  adminAuditLog: vi.fn(),
}));

vi.mock('@/lib/route-helpers', () => ({
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

import { POST } from '@/app/api/admin/login/route';
import { checkRateLimit } from '@/lib/rate-limit';

let LoginPOST: typeof POST;

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset modules to get fresh failedAttempts Map each test
  vi.resetModules();
  const mod = await import('@/app/api/admin/login/route');
  LoginPOST = mod.POST;
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9, resetMs: 300000 });
  process.env.ADMIN_PASSWORD = 'test-admin-password-secure';
});

describe('POST /api/admin/login', () => {
  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await LoginPOST(makeReq({ password: 'x' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid schema (missing password)', async () => {
    const res = await LoginPOST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 401 for wrong password', async () => {
    const res = await LoginPOST(makeReq({ password: 'wrong-password' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 with cookie for correct password', async () => {
    const res = await LoginPOST(makeReq({ password: 'test-admin-password-secure' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.headers.get('Set-Cookie')).toContain('ws_admin');
  });

  it('returns 500 when ADMIN_PASSWORD env var is missing', async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await LoginPOST(makeReq({ password: 'anything' }));
    expect(res.status).toBe(500);
  });

  it('locks out after too many failed attempts', async () => {
    // Send 10 wrong passwords from the same IP
    for (let i = 0; i < 10; i++) {
      await LoginPOST(makeReq({ password: `wrong-${i}` }));
    }
    // 11th attempt should be locked out
    const res = await LoginPOST(makeReq({ password: 'wrong-11' }));
    expect(res.status).toBe(429);
  });

  it('clears failed attempt counter on successful login', async () => {
    // 5 failed attempts (below 10-attempt lockout threshold)
    for (let i = 0; i < 5; i++) {
      await LoginPOST(makeReq({ password: `wrong-${i}` }));
    }
    // Successful login should clear the counter
    const successRes = await LoginPOST(makeReq({ password: 'test-admin-password-secure' }));
    expect(successRes.status).toBe(200);
    // After clearing, 5 more failures should NOT lock out
    // (counter was reset by the successful login)
    for (let i = 0; i < 5; i++) {
      const r = await LoginPOST(makeReq({ password: `wrong-again-${i}` }));
      expect(r.status).toBe(401); // 401 = wrong password, NOT 429 = locked out
    }
  });
});
