/**
 * Integration tests for secure/upload-url route
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockCreateSignedUploadUrl = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: mockFrom,
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      }),
    },
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 14, resetMs: 60000 }),
  // Async (distributed) limiter - routes awaiting it resolve allowed by default.
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 14, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    upload: { maxRequests: 15, windowMs: 60000 },
    standard: { maxRequests: 30, windowMs: 60000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
  getSessionFromRequest: vi.fn().mockReturnValue(null),
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

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/secure/upload-url/route';
import { secureGuard, isSafePath } from '@/lib/route-helpers';
import { createQueryMock } from '../../helpers/supabase-mock';

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  // Chat-media paths verify conversation membership; default to the session user being a member.
  mockFrom.mockReturnValue(createQueryMock({
    data: { a_participant_id: 'p1', b_participant_id: 'p2' },
    error: null,
  }));
  vi.mocked(secureGuard).mockResolvedValue(session as any);
  vi.mocked(isSafePath).mockReturnValue(true);
  mockCreateSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example.com/signed', token: 'tok', path: 'e1/p1/photo.jpg' },
    error: null,
  });
});

describe('POST /api/secure/upload-url', () => {
  it('returns 400 for missing path', async () => {
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsafe path', async () => {
    vi.mocked(isSafePath).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '../etc/passwd' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid file extension', async () => {
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'e1/p1/malware.exe' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 for path not scoped to participant', async () => {
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'other-event/other-user/photo.jpg' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns signed URL for valid profile photo path', async () => {
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'e1/p1/photo.jpg' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBeDefined();
    expect(body.token).toBeDefined();
  });

  it('returns signed URL for chat media path', async () => {
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'chat/e1/conv1/image.webp' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 when storage createSignedUploadUrl fails', async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage error' },
    });
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'e1/p1/photo.jpg' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('I-SGN-04: no session → returns error response', async () => {
    const { NextResponse } = await import('next/server');
    vi.mocked(secureGuard).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    );
    const req = new NextRequest('http://localhost/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'e1/p1/photo.jpg' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('accepts various allowed extensions', async () => {
    // HEIC/HEIF are intentionally excluded (iOS converts to JPEG when sharing to web).
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp3', 'mp4']) {
      const req = new NextRequest('http://localhost/api/secure/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `e1/p1/file.${ext}` }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});
