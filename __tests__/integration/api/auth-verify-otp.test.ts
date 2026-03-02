/**
 * Integration tests for POST /api/auth/verify-otp
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
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    auth: { maxRequests: 5, windowMs: 300000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  signSessionToken: vi.fn().mockReturnValue('mock-jwt'),
  sessionCookieHeader: vi.fn().mockReturnValue('ws_session=mock-jwt; Path=/; HttpOnly'),
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
  verifyOtp: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/messaging', () => ({
  normalizePhone: vi.fn((p: string) =>
    p.startsWith('+972') ? p : p.startsWith('05') ? `+972${p.slice(1)}` : null
  ),
  isValidIsraeliMobile: vi.fn((p: string) => {
    const norm = p.startsWith('+972') ? p : `+972${p.slice(1)}`;
    return /^\+9725\d{8}$/.test(norm);
  }),
  sendWelcomeMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import { POST } from '@/app/api/auth/verify-otp/route';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyOtp } from '@/lib/otp';

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  phone: '0501234567',
  code: '123456',
  eventSlug: 'summer',
  joinCode: 'ABCDEFGHIJKL',
  smsConsent: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkCsrf).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4, resetMs: 300000 });
  vi.mocked(verifyOtp).mockResolvedValue({ valid: true });
});

// ─── Helpers ────────────────────────────────────────────

function mockEventLookup(event: Record<string, unknown> | null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: event, error: null }),
  });
}

function mockBanCheck(banned: boolean) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: banned ? { id: 'ban1' } : null,
      error: null,
    }),
    then: vi.fn().mockResolvedValue(banned),
  });
}

const eventData = {
  id: 'e1', slug: 'summer', name: 'Summer Party',
  join_code: 'ABCDEFGHIJKL', is_active: true,
  background_image: null, wa_messages_enabled: true,
};

describe('POST /api/auth/verify-otp', () => {
  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrf).mockReturnValue(false);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
  });

  it('returns 400 for missing code', async () => {
    const { code: _, ...noCode } = validBody;
    const res = await POST(makeReq(noCode));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid phone', async () => {
    const res = await POST(makeReq({ ...validBody, phone: '031234567' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when event not found', async () => {
    mockEventLookup(null);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
  });

  it('returns 400 (or 429) for wrong OTP code', async () => {
    mockEventLookup(eventData);
    vi.mocked(verifyOtp).mockResolvedValue({ valid: false, error: 'Incorrect code' });
    const res = await POST(makeReq({ ...validBody, code: '000000' }));
    expect(res.status).toBe(400);
  });

  it('returns 429 for too many OTP attempts', async () => {
    mockEventLookup(eventData);
    vi.mocked(verifyOtp).mockResolvedValue({ valid: false, error: 'Too many attempts' });
    const res = await POST(makeReq({ ...validBody, code: '000000' }));
    expect(res.status).toBe(429);
  });

  it('returns 200 with session on successful new participant', async () => {
    mockEventLookup(eventData);

    // Ban check (phone) → not banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnValue({
        then: vi.fn().mockResolvedValue(false),
      }),
    });

    // Find existing participant → none
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });

    // Create new participant
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'p-new' }, error: null }),
    });

    // Activity log (fire-and-forget)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participantId).toBe('p-new');
    expect(body.eventId).toBe('e1');
    expect(res.headers.get('Set-Cookie')).toContain('ws_session');
  });

  it('reconnects existing participant by phone', async () => {
    mockEventLookup(eventData);

    // Ban check → not banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnValue({
        then: vi.fn().mockResolvedValue(false),
      }),
    });

    // Find existing participant → found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'p-existing', event_id: 'e1', phone: '+972501234567',
          display_name: 'Dana', gender: 'female', attracted_to: 'all',
          bio: null, age: 25, city: 'Tel Aviv', looking_for: null,
          is_banned: false, last_seen_at: null, created_at: '2025-01-01',
          device_fingerprint: null, hardware_fingerprint: null,
          sms_consent: true, feedback_sent: false,
        },
      }),
    });

    // Update participant (fire-and-forget)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participantId).toBe('p-existing');
    // Phone + fingerprints should be stripped
    expect(body.participant?.phone).toBeUndefined();
    expect(body.participant?.device_fingerprint).toBeUndefined();
  });

  it('returns 403 when reconnected participant is banned', async () => {
    mockEventLookup(eventData);

    // Ban check → not banned at device level
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnValue({
        then: vi.fn().mockResolvedValue(false),
      }),
    });

    // Find existing participant → banned
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'p-banned', event_id: 'e1', phone: '+972501234567',
          is_banned: true, display_name: 'Banned', gender: 'male',
          attracted_to: 'all', bio: null, age: 30, city: null,
          looking_for: null, last_seen_at: null, created_at: '2025-01-01',
          device_fingerprint: null, hardware_fingerprint: null,
          sms_consent: false, feedback_sent: false,
        },
      }),
    });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });
});
