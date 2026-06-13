/**
 * Integration tests for /api/admin/events/[eventId]/guests (GET, POST, DELETE)
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
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
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

vi.mock('@/lib/config', () => ({
  MAX_GUEST_NAME_LENGTH: 100,
  MAX_GUEST_PHONES_PER_EVENT: 500,
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeWithLimit: vi.fn((s: string) => s.trim()),
}));

import { GET, POST, DELETE } from '@/app/api/admin/events/[eventId]/guests/route';
import { createQueryMock } from '../../helpers/supabase-mock';

const eventId = '11111111-1111-1111-1111-111111111111';

function makeGetReq() {
  return new NextRequest(`http://localhost/api/admin/events/${eventId}/guests`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePostReq(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/admin/events/${eventId}/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/admin/events/${eventId}/guests`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ eventId });

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the from() queue and provide a benign default so fire-and-forget /
  // status-update queries never return undefined; per-test Once mocks win.
  mockFrom.mockReset();
  mockFrom.mockReturnValue(createQueryMock({ data: null, error: null }));
});

describe('GET /api/admin/events/[eventId]/guests', () => {
  it('returns guest list on success', async () => {
    const guests = [
      { id: 'g1', event_id: eventId, phone: '+972501234567', guest_name: 'Dana', wa_pre_event_sent: false, wa_pre_event_sent_at: null, created_at: '2025-01-01' },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: guests, error: null }),
    });

    const res = await GET(makeGetReq(), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guests).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it('returns 500 on DB error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });

    const res = await GET(makeGetReq(), { params });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/events/[eventId]/guests (JSON)', () => {
  function mockEventAndExisting(existing: Array<{ phone: string }> = []) {
    // Event lookup (route uses .maybeSingle())
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: eventId, wa_messages_enabled: true },
      error: null,
    }));
    // Existing phones
    mockFrom.mockReturnValueOnce(createQueryMock({ data: existing, error: null }));
  }

  it('imports valid guest phones via JSON', async () => {
    mockEventAndExisting();
    // Insert
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    // Update guest list status (count)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 2 }));
    // Update event
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const res = await POST(
      makePostReq({ guests: [{ phone: '0501234567' }, { phone: '0521234568' }] }),
      { params }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.added).toBe(2);
  });

  it('skips duplicates against existing phones', async () => {
    mockEventAndExisting([{ phone: '+972501234567' }]);
    // Insert (only 1 new)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    // Update status
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 2 }));
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(
      makePostReq({ guests: [{ phone: '0501234567' }, { phone: '0521234568' }] }),
      { params }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.duplicates).toBe(1);
    expect(data.added).toBe(1);
  });

  it('returns error for invalid input (empty guests array)', async () => {
    // Route checks event first, then validates → need event + existing mocks
    mockEventAndExisting();
    const res = await POST(makePostReq({ guests: [] }), { params });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/events/[eventId]/guests', () => {
  it('removes guest phones by IDs', async () => {
    // Delete
    mockFrom.mockReturnValueOnce(createQueryMock({ data: [{ id: 'g1' }], error: null }));
    // Update status (count)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null, count: 0 }));
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const res = await DELETE(makeDeleteReq({ phoneIds: ['g1'] }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.removed).toBe(1);
  });

  it('returns 400 when no phoneIds provided', async () => {
    const res = await DELETE(makeDeleteReq({ phoneIds: [] }), { params });
    expect(res.status).toBe(400);
  });
});
