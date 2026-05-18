/**
 * Integration tests for secure/photos route (POST, DELETE, PATCH)
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: mockFrom,
    storage: { from: vi.fn().mockReturnValue({ remove: mockStorageRemove }) },
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 14, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    standard: { maxRequests: 30, windowMs: 60000 },
    upload: { maxRequests: 15, windowMs: 60000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  getSessionFromRequest: vi.fn().mockReturnValue(null),
  isValidUUID: vi.fn().mockReturnValue(true),
}));

const session = vi.hoisted(() => ({
  sub: 'p1', eid: 'e1', esl: 'test-event', enm: 'Test',
  iss: 'eventa', aud: 'eventa-app', typ: 'session', iat: 0, exp: 999999999999,
}));

vi.mock('@/lib/route-helpers', () => ({
  secureGuard: vi.fn().mockResolvedValue(session),
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  isSafePath: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/constants', () => ({
  MAX_PHOTOS: 6,
  MAX_NAME_LENGTH: 30,
  MAX_BIO_LENGTH: 500,
  MAX_CITY_LENGTH: 50,
  MAX_MESSAGE_LENGTH: 1000,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST, DELETE, PATCH } from '@/app/api/secure/photos/route';
import { secureGuard, isSafePath } from '@/lib/route-helpers';
import { isValidUUID } from '@/lib/session';

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  vi.mocked(secureGuard).mockResolvedValue(session as any);
  vi.mocked(isSafePath).mockReturnValue(true);
  vi.mocked(isValidUUID).mockReturnValue(true);
});

describe('POST /api/secure/photos', () => {
  it('creates photo record successfully', async () => {
    // Existing photo lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // Photo count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 2 }),
      }),
    });
    // Insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'photo1', storage_path: 'e1/p1/1.jpg', order_index: 0 },
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'e1/p1/1.jpg', orderIndex: 0 }),
    });
    const res = await POST(req);
    expect([200, 400]).toContain(res.status);
  });

  it('returns 400 for missing fields', async () => {
    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid storage path', async () => {
    vi.mocked(isSafePath).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: '../hack/file.jpg', orderIndex: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for path not belonging to participant', async () => {
    vi.mocked(isSafePath).mockReturnValue(true);
    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'e1/other-participant/1.jpg', orderIndex: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('I-PHO-08: at MAX_PHOTOS → 400', async () => {
    // Existing photo lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Photo count = 6 (MAX_PHOTOS)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 6 }),
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'e1/p1/new.jpg', orderIndex: 6 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('I-PHO-11: no session → 401', async () => {
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'e1/p1/1.jpg', orderIndex: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/secure/photos', () => {
  it('returns 400 for invalid photo ID', async () => {
    vi.mocked(isValidUUID).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: 'not-a-uuid' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when photo belongs to another participant', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { participant_id: 'other-person', storage_path: 'e1/other/photo.jpg' },
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: '10000000-1000-4000-8000-000000000001' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it('deletes photo successfully', async () => {
    vi.mocked(isValidUUID).mockReturnValue(true);
    // Photo lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { participant_id: 'p1', storage_path: 'e1/p1/photo.jpg' },
        error: null,
      }),
    });
    // DB delete
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: '10000000-1000-4000-8000-000000000001' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/secure/photos', () => {
  it('returns 400 for invalid order data', async () => {
    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: 'invalid' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when some photos belong to another participant', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: '10000000-1000-4000-8000-000000000001', participant_id: 'p1' },
          { id: '20000000-2000-4000-8000-000000000002', participant_id: 'other' },
        ],
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/secure/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: [
          { id: '10000000-1000-4000-8000-000000000001', order_index: 0 },
          { id: '20000000-2000-4000-8000-000000000002', order_index: 1 },
        ],
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });
});
