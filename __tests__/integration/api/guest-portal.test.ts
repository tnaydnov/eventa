/**
 * Integration tests for /api/guest-portal/[token] (GET, POST)
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
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  // Async (distributed) limiter — routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
    upload: { maxRequests: 10, windowMs: 60000 },
  },
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

vi.mock('@/lib/messaging/phone-utils', () => ({
  normalizePhone: vi.fn((p: string) =>
    p.startsWith('+972') ? p : p.startsWith('05') ? `+972${p.slice(1)}` : null
  ),
  isValidIsraeliMobile: vi.fn((p: string) => {
    const n = p.startsWith('+972') ? p : `+972${p.slice(1)}`;
    return /^\+9725\d{8}$/.test(n);
  }),
  formatPhoneDisplay: vi.fn((p: string) => {
    if (!p.startsWith('+972') || p.length !== 13) return p;
    const local = p.slice(4);
    return `+972-${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  }),
}));

import { GET, POST } from '@/app/api/guest-portal/[token]/route';
import { checkRateLimit } from '@/lib/rate-limit';
import { createQueryMock } from '../../helpers/supabase-mock';

const token = 'valid-portal-token-123';
const eventId = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the from() queue + benign default so unconsumed/extra queries (e.g. the
  // sentCount status query) never return undefined; per-test Once mocks win.
  mockFrom.mockReset();
  mockFrom.mockReturnValue(createQueryMock({ data: null, error: null }));
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9, resetMs: 60000 });
});

// ─── Token & event setup helpers ────────────────────────

function mockTokenValid() {
  // Token lookup
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: 'tok-1', event_id: eventId, token, is_active: true },
      error: null,
    }),
  });
  // Update last_used_at
  mockFrom.mockReturnValueOnce({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
}

function mockTokenInvalid() {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
}

const params = Promise.resolve({ token });

describe('GET /api/guest-portal/[token]', () => {
  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const req = new NextRequest(`http://localhost/api/guest-portal/${token}`);
    const res = await GET(req, { params });
    expect(res.status).toBe(429);
  });

  it('returns 401 for invalid token', async () => {
    mockTokenInvalid();
    const req = new NextRequest(`http://localhost/api/guest-portal/${token}`);
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it('returns portal data on valid token', async () => {
    mockTokenValid();
    // Event lookup (route uses .maybeSingle())
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: {
        id: eventId, name: 'Summer', starts_at: '2099-08-15',
        ends_at: '2099-08-16', status: 'active',
        wa_messages_enabled: true, guest_list_uploaded: true, guest_list_count: 2,
      },
      error: null,
    }));
    // Paginated guests
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: [
        { id: 'g1', phone: '+972501234567', guest_name: 'Dana', wa_pre_event_sent: false, created_at: '2025-01-01' },
      ],
      error: null,
      count: 1,
    }));

    const req = new NextRequest(`http://localhost/api/guest-portal/${token}?page=1`);
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.name).toBe('Summer');
    expect(data.guests).toHaveLength(1);
    expect(data.guests[0].phone).toBeDefined();
    expect(data.isReadOnly).toBe(false);
  });
});

describe('POST /api/guest-portal/[token] (single add)', () => {
  it('returns 401 for invalid token', async () => {
    mockTokenInvalid();
    const req = new NextRequest(`http://localhost/api/guest-portal/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0501234567' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it('adds a single phone successfully', async () => {
    mockTokenValid();
    // Event status check (route uses .maybeSingle()); messaging on + future date so not read-only
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: eventId, status: 'active', wa_messages_enabled: true, starts_at: '2099-08-15' },
      error: null,
    }));
    // handleSingleAdd: count check (select with count: 'exact', head: true)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 5 }),
    });
    // handleSingleAdd: dup check (select → eq → eq → maybeSingle)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // handleSingleAdd: insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    // updateGuestListStatus: count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 6 }),
    });
    // updateGuestListStatus: update event
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    // Final count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 6 }),
    });

    const req = new NextRequest(`http://localhost/api/guest-portal/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0501234567', name: 'Test' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.totalInList).toBe(6);
  });

  it('returns 400 when event is archived', async () => {
    mockTokenValid();
    // Event → archived (route uses .maybeSingle())
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { id: eventId, status: 'archived' }, error: null }));

    const req = new NextRequest(`http://localhost/api/guest-portal/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0501234567' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });
});


