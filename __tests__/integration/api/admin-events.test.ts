/**
 * Integration tests for GET/POST /api/admin/events
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
  generateJoinCode: vi.fn().mockReturnValue('ABCD'),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    strict: { maxRequests: 5, windowMs: 60000 },
  },
}));

vi.mock('@/lib/admin-auth', () => ({
  verifyAdminFromRequest: vi.fn().mockReturnValue(true),
  adminAuditLog: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  isValidUUID: vi.fn().mockReturnValue(true),
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

import { GET, POST } from '@/app/api/admin/events/route';
import { verifyAdminFromRequest } from '@/lib/admin-auth';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(verifyAdminFromRequest).mockReturnValue(true);
});

describe('GET /api/admin/events', () => {
  it('returns events list', async () => {
    const events = [
      { id: 'e1', name: 'Event 1', slug: 'event-1', status: 'active' },
      { id: 'e2', name: 'Event 2', slug: 'event-2', status: 'paused' },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: events, error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/events');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(2);
  });

  it('filters by status query param', async () => {
    const eqFn = vi.fn().mockReturnThis();
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: eqFn,
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/events?status=active');
    await GET(req);
    expect(eqFn).toHaveBeenCalledWith('status', 'active');
  });

  it('returns 401 when not admin', async () => {
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/events');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 500 on DB error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/events', () => {
  it('creates event with auto-generated slug', async () => {
    // Slug check — no collision
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // Event insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'e1', name: 'My Wedding', slug: 'my-wedding-a1b2', status: 'active' },
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Wedding',
        starts_at: '2025-06-01T10:00:00Z',
        ends_at: '2025-06-01T22:00:00Z',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.name).toBe('My Wedding');
  });

  it('returns 400 for invalid input', async () => {
    const req = new NextRequest('http://localhost/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('handles slug collision by appending suffix', async () => {
    // Slug check — collision found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
    });
    // Event insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'e2', name: 'Test', slug: 'test-xxxx-yyyy', status: 'active' },
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        slug: 'test-xxxx',
        starts_at: '2025-06-01T10:00:00Z',
        ends_at: '2025-06-01T22:00:00Z',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('I-ADM-EVT-CR-05: returns 401 when not admin (POST)', async () => {
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        starts_at: '2025-06-01T10:00:00Z',
        ends_at: '2025-06-01T22:00:00Z',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('I-ADM-EVT-03: returns 500 on DB insert error', async () => {
    // Slug check passes
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // Event insert fails
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        starts_at: '2025-06-01T10:00:00Z',
        ends_at: '2025-06-01T22:00:00Z',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
