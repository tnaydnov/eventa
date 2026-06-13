/**
 * Integration tests for POST /api/auth/send-otp
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock dependencies ──────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetMs: 300000 }),
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, resetMs: 300000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
    auth: { maxRequests: 5, windowMs: 300000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
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

vi.mock('@/lib/otp', () => ({
  createOtp: vi.fn().mockResolvedValue({ code: '123456', expiresIn: 300 }),
}));

vi.mock('@/lib/messaging', () => ({
  normalizePhone: vi.fn((p: string) =>
    p.startsWith('+972') ? p : p.startsWith('05') ? `+972${p.slice(1)}` : null
  ),
  isValidIsraeliMobile: vi.fn((p: string) => {
    const norm = p.startsWith('+972') ? p : `+972${p.slice(1)}`;
    return /^\+9725\d{8}$/.test(norm);
  }),
  maskPhone: vi.fn((p: string) => `+972-5X-***-${p.slice(-4)}`),
  sendOtp: vi.fn().mockResolvedValue({ success: true, provider: 'sms', messageId: 'msg-1' }),
}));

import { POST } from '@/app/api/auth/send-otp/route';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit, checkRateLimitAsync } from '@/lib/rate-limit';
import { createOtp } from '@/lib/otp';
import { sendOtp } from '@/lib/messaging';
import { createQueryMock } from '../../helpers/supabase-mock';

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = { phone: '0501234567', eventSlug: 'summer', joinCode: 'ABCDEFGHIJKL' };

beforeEach(() => {
  vi.clearAllMocks();
  // Default from() chain so fire-and-forget inserts (e.g. funnel_events) never
  // return undefined; per-test mockReturnValueOnce still takes precedence.
  mockFrom.mockReset();
  mockFrom.mockReturnValue(createQueryMock({ data: null, error: null }));
  vi.mocked(checkCsrf).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4, resetMs: 300000 });
  vi.mocked(checkRateLimitAsync).mockResolvedValue({ allowed: true, remaining: 4, resetMs: 300000 });
  vi.mocked(createOtp).mockResolvedValue({ code: '123456', expiresIn: 300 });
  vi.mocked(sendOtp).mockResolvedValue({ success: true, provider: 'sms', messageId: 'msg-1' });
});

describe('POST /api/auth/send-otp', () => {
  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrf).mockReturnValue(false);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    vi.mocked(checkRateLimitAsync).mockResolvedValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
  });

  it('returns 400 for missing phone', async () => {
    const res = await POST(makeReq({ eventSlug: 'e', joinCode: 'ABCDEFGHIJKL' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid phone number (landline)', async () => {
    const res = await POST(makeReq({ phone: '031234567', eventSlug: 'e', joinCode: 'ABCDEFGHIJKL' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
  });

  it('returns 403 when phone is banned', async () => {
    // Event lookup → found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'e1', slug: 'summer', name: 'Summer', join_code: 'ABCDEFGHIJKL', is_active: true },
        error: null,
      }),
    });
    // Ban check → banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ban1' }, error: null }),
    });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 429 when OTP cooldown active', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'e1', slug: 'summer', name: 'Summer', join_code: 'ABCDEFGHIJKL', is_active: true },
        error: null,
      }),
    });
    // Ban check → not banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // OTP cooldown
    vi.mocked(createOtp).mockResolvedValue({ error: 'Wait 45 seconds' });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
  });

  it('returns 200 with maskedPhone on success', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'e1', slug: 'summer', name: 'Summer', join_code: 'ABCDEFGHIJKL', is_active: true },
        error: null,
      }),
    });
    // Ban check → not banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.expiresIn).toBe(300);
    expect(body.maskedPhone).toBeDefined();
  });

  it('returns 500 when SMS send fails', async () => {
    // Event lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'e1', slug: 'summer', name: 'Summer', join_code: 'ABCDEFGHIJKL', is_active: true },
        error: null,
      }),
    });
    // Ban check → not banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // SMS fails
    vi.mocked(sendOtp).mockResolvedValue({ success: false, provider: 'sms', error: 'Provider down' });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
  });
});
