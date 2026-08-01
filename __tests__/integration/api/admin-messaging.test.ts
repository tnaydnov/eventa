/**
 * Integration tests for /api/admin/events/[eventId]/messaging (GET, PATCH, POST)
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock dependencies ──────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/admin-auth', () => ({
  verifyAdminFromRequest: vi.fn().mockReturnValue(true),
  adminAuditLog: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  // Async (distributed) limiter - routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  isValidUUID: vi.fn((id: string) => /^[0-9a-f-]{36}$/.test(id)),
}));

vi.mock('@/lib/route-helpers', () => ({
  // adminGuard imports verifyCronAuth; default false = no cron auth (tests authenticate via admin cookie).
  verifyCronAuth: vi.fn().mockReturnValue(false),
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

vi.mock('@/lib/messaging', () => ({
  sendPreEventMessage: vi.fn().mockResolvedValue({ success: true }),
  sendFeedbackMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET, PATCH, POST } from '@/app/api/admin/events/[eventId]/messaging/route';
import { createQueryMock } from '../../helpers/supabase-mock';

const eventId = '11111111-1111-1111-1111-111111111111';
const params = Promise.resolve({ eventId });

function makeReq(method: string, body?: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/admin/events/${eventId}/messaging`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default benign chain so messaging-send / status-update queries never return
  // undefined; per-test mockReturnValueOnce still takes precedence.
  mockFrom.mockReset();
  mockFrom.mockReturnValue(createQueryMock({ data: null, error: null }));
});

describe('GET /api/admin/events/[eventId]/messaging', () => {
  it('returns messaging overview on success', async () => {
    // Parallel queries: event, guests, portal token, message log, participants
    const eventRes = {
      data: {
        id: eventId, wa_messages_enabled: true,
        guest_list_uploaded: true, guest_list_uploaded_at: '2025-01-01',
        guest_list_count: 5, messaging_config: null,
      },
      error: null,
    };
    const guestsRes = { data: [{ id: 'g1', wa_pre_event_sent: false }], error: null };
    const tokenRes = { data: { token: 'tok', created_at: '2025-01-01', last_used_at: null }, error: null };
    const logRes = {
      data: [
        { id: 'l1', channel: 'whatsapp', message_type: 'pre_event', status: 'sent' },
        { id: 'l2', channel: 'sms', message_type: 'welcome', status: 'sent' },
      ],
      error: null,
    };
    const participantsRes = {
      data: [
        { id: 'p1', feedback_sent: false, sms_consent: true },
      ],
      error: null,
    };

    // The route queries 5 tables in parallel via Promise.all
    // Since they all use from(), the mock needs to handle 5 calls
    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      callIdx++;
      const results = [eventRes, guestsRes, tokenRes, logRes, participantsRes];
      const r = results[callIdx - 1] || { data: null, error: null };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(r),
        maybeSingle: vi.fn().mockResolvedValue(r),
        not: vi.fn().mockResolvedValue(r),
        then: vi.fn((cb: (v: unknown) => unknown) => Promise.resolve(cb(r))),
        [Symbol.thenableTag]: true,
      };
    });

    const res = await GET(makeReq('GET'), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.wa_messages_enabled).toBe(true);
    expect(data.guest_list_count).toBe(5);
    expect(data.pre_event_sent_count).toBeDefined();
  });
});

describe('PATCH /api/admin/events/[eventId]/messaging', () => {
  it('toggles WA messaging', async () => {
    // Update event
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await PATCH(makeReq('PATCH', { wa_messages_enabled: false }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('returns 400 for empty patch', async () => {
    const res = await PATCH(makeReq('PATCH', {}), { params });
    expect(res.status).toBe(400);
  });

  it('merges messaging_config with existing', async () => {
    // Fetch existing config (route uses .maybeSingle())
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { messaging_config: { pre_event_hours_before: 3 } },
      error: null,
    }));
    // Update
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const res = await PATCH(
      makeReq('PATCH', { messaging_config: { feedback_hours_after: 5 } }),
      { params }
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/events/[eventId]/messaging', () => {
  it('returns 400 for invalid action', async () => {
    const res = await POST(makeReq('POST', { action: 'invalid_action' }), { params });
    expect(res.status).toBe(400);
  });

  it('triggers pre-event messages', async () => {
    // Event lookup (route uses .maybeSingle())
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: {
        id: eventId, slug: 'test', name: 'Test',
        join_code: 'CODE', wa_messages_enabled: true, starts_at: '2025-08-15',
      },
      error: null,
    }));
    // Unsent guests
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: [{ id: 'g1', phone: '+972501234567', guest_name: 'Dana', wa_pre_event_sent: false }],
      error: null,
    }));
    // Mark sent
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const res = await POST(makeReq('POST', { action: 'send_pre_event' }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(0);
  });

  it('returns 400 when WA not enabled', async () => {
    // Event lookup → WA disabled (route uses .maybeSingle())
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: {
        id: eventId, slug: 'test', name: 'Test',
        join_code: 'CODE', wa_messages_enabled: false, starts_at: '2025-08-15',
      },
      error: null,
    }));

    const res = await POST(makeReq('POST', { action: 'send_pre_event' }), { params });
    expect(res.status).toBe(400);
  });
});
