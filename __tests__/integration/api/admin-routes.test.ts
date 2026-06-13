/**
 * Integration tests for admin event management routes
 * Tests: auto-archive, helpers, events/[eventId] PATCH, stats, rotate, archive,
 * delete, background, analytics, participants, global-analytics
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryMock } from '../../helpers/supabase-mock';

/* ─────── shared mocks ─────── */
const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { path: 'e1/bg.jpg' }, error: null }));
const mockStorageGetPublicUrl = vi.hoisted(() => vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/bg.jpg' } }));
const mockStorageRemove = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const mockStorageFrom = vi.hoisted(() => vi.fn().mockReturnValue({
  upload: mockStorageUpload,
  getPublicUrl: mockStorageGetPublicUrl,
  remove: mockStorageRemove,
}));

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom, storage: { from: mockStorageFrom } }),
  generateJoinCode: vi.fn().mockReturnValue('NEWCODE'),
  generateShortCode: vi.fn().mockReturnValue('abc123'),
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

vi.mock('@/lib/admin-auth', () => ({
  verifyAdminFromRequest: vi.fn().mockReturnValue(true),
  adminAuditLog: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  isValidUUID: vi.fn().mockReturnValue(true),
  checkCsrf: vi.fn().mockReturnValue(true),
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
  evictEventStatusCache: vi.fn(),
  evictBanCache: vi.fn(),
  bumpSessionEpoch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/constants', () => ({
  RETENTION_DAYS: 30,
  STORAGE_BATCH_SIZE: 100,
  MAX_PHOTOS: 6,
  MAX_BACKGROUND_SIZE_BYTES: 5 * 1024 * 1024,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/validations', () => ({
  updateEventSchema: {
    safeParse: vi.fn((data: Record<string, unknown>) => {
      if (Object.keys(data).length === 0) return { success: false, error: { flatten: () => ({ fieldErrors: { name: ['Required'] } }) } };
      return { success: true, data };
    }),
  },
  validateImageMagicBytes: vi.fn().mockReturnValue(true),
}));

/** Helper: create params wrapper for Next.js 15+ dynamic routes */
const params = (eventId: string) => ({ params: Promise.resolve({ eventId }) });

beforeEach(async () => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  // Benign default so overflow / fire-and-forget / analytics-compute queries
  // never return undefined; per-test mockReturnValueOnce always takes precedence.
  mockFrom.mockReturnValue(createQueryMock({ data: [], error: null }));

  // Re-set module mocks to defaults (clearAllMocks preserves impl but tests change them)
  const rl = await import('@/lib/rate-limit');
  vi.mocked(rl.checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetMs: 60000 } as any);
  vi.mocked(rl.getClientIp).mockReturnValue('127.0.0.1');

  const aa = await import('@/lib/admin-auth');
  vi.mocked(aa.verifyAdminFromRequest).mockReturnValue(true);

  const sess = await import('@/lib/session');
  vi.mocked(sess.isValidUUID).mockReturnValue(true);
  vi.mocked(sess.checkCsrf).mockReturnValue(true);

  mockStorageFrom.mockReturnValue({
    upload: mockStorageUpload,
    getPublicUrl: mockStorageGetPublicUrl,
    remove: mockStorageRemove,
  });
  mockStorageUpload.mockResolvedValue({ data: { path: 'e1/bg.jpg' }, error: null });
  mockStorageRemove.mockResolvedValue({ error: null });
});

/* ═══════════════════════════════════════════════════════════════════
   _helpers.ts - adminGuard + validateEventId
   ═══════════════════════════════════════════════════════════════════ */
describe('adminGuard (_helpers.ts)', () => {
  let adminGuard: typeof import('@/app/api/admin/_helpers').adminGuard;
  let validateEventId: typeof import('@/app/api/admin/_helpers').validateEventId;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/_helpers');
    adminGuard = mod.adminGuard;
    validateEventId = mod.validateEventId;
  });

  it('returns null (allowed) for valid admin cookie auth', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);
    const { checkCsrf } = await import('@/lib/session');
    vi.mocked(checkCsrf).mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/admin/test', { method: 'POST' });
    const result = adminGuard(req, 'test', { maxRequests: 10, windowMs: 60000 });
    expect(result).toBeNull();
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 30000 });

    const req = new NextRequest('http://localhost/api/admin/test');
    const result = adminGuard(req, 'test', { maxRequests: 10, windowMs: 60000 });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it('returns 401 when not admin and no cron auth', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/test');
    const result = adminGuard(req, 'test', { maxRequests: 10, windowMs: 60000 });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns 400 for invalid UUID via validateEventId', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(false);
    const result = validateEventId('not-a-uuid');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
  });

  it('returns null for valid UUID via validateEventId', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);
    const result = validateEventId('00000000-0000-0000-0000-000000000001');
    expect(result).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   auto-archive
   ═══════════════════════════════════════════════════════════════════ */
describe('GET|POST /api/admin/auto-archive', () => {
  let GET: (req: NextRequest) => Promise<Response>;
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/auto-archive/route');
    GET = mod.GET;
    POST = mod.POST;
  });

  it('rejects unauthorized request', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/auto-archive');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('succeeds when nothing to archive or end', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);

    // endable events query (events.select().in().lt())
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    // archivable events query (events.select().eq().lt())
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/auto-archive');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ended).toBe(0);
    expect(body.archived).toBe(0);
  });

  it('returns dry_run summary without modifying data', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);

    // endable events
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [{ id: 'e1', name: 'Event 1' }],
        error: null,
      }),
    });
    // archivable events
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [{ id: 'e2', name: 'Old Event' }],
        error: null,
      }),
    });

    const req = new NextRequest('http://localhost/api/admin/auto-archive?dry_run=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.wouldEnd).toBe(1);
    expect(body.wouldArchive).toBe(1);
  });

  it('returns 500 when endable events query fails', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/auto-archive');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('POST handler works same as GET', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/auto-archive', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId] PATCH
   ═══════════════════════════════════════════════════════════════════ */
describe('PATCH /api/admin/events/[eventId]', () => {
  let handler: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/route');
    handler = mod.PATCH;
  });

  it('returns 400 for invalid eventId', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/events/bad', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await handler(req, params('bad'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid input (Zod fails)', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/admin/events/e1', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(400);
  });

  it('updates event and returns data', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', name: 'Updated Name', status: 'active' },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/admin/events/e1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.name).toBe('Updated Name');
  });

  it('evicts cache when status changes', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);
    const { evictEventStatusCache } = await import('@/lib/route-helpers');

    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', status: 'ended' },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/admin/events/e1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ended' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await handler(req, params('e1'));
    expect(evictEventStatusCache).toHaveBeenCalledWith('e1');
  });

  it('returns 500 on DB error', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'X' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(500);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/rotate
   ═══════════════════════════════════════════════════════════════════ */
describe('POST /api/admin/events/[eventId]/rotate', () => {
  let handler: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/rotate/route');
    handler = mod.POST;
  });

  it('generates a new join code', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', join_code: 'NEWCODE' },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/admin/events/e1/rotate', { method: 'POST' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.join_code).toBe('NEWCODE');
  });

  it('returns 500 on DB error', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/rotate', { method: 'POST' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(500);
  });

  it('returns 401 when not admin', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/events/e1/rotate', { method: 'POST' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(401);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/stats
   ═══════════════════════════════════════════════════════════════════ */
describe('GET /api/admin/events/[eventId]/stats', () => {
  let handler: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/stats/route');
    handler = mod.GET;
  });

  it('returns counts for all 5 tables', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    // 5 parallel count queries (participants, conversations, likes, messages, blocks)
    const makeCountMock = (count: number) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, count, error: null }),
    });

    mockFrom
      .mockReturnValueOnce(makeCountMock(10))  // participants
      .mockReturnValueOnce(makeCountMock(5))   // conversations
      .mockReturnValueOnce(makeCountMock(20))  // likes
      .mockReturnValueOnce(makeCountMock(50))  // messages
      .mockReturnValueOnce(makeCountMock(2));  // blocks

    const req = new NextRequest('http://localhost/api/admin/events/e1/stats');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participants).toBe(10);
    expect(body.conversations).toBe(5);
    expect(body.likes).toBe(20);
    expect(body.messages).toBe(50);
    expect(body.blocks).toBe(2);
  });

  it('returns 500 when any count query fails', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, count: null, error: { message: 'DB err' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/stats');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(500);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/participants
   ═══════════════════════════════════════════════════════════════════ */
describe('participants management', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/participants/route');
    GET = mod.GET;
    PATCH = mod.PATCH;
  });

  it('GET returns participants with profile_complete flag', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    // First call: participants query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'p1', display_name: 'User 1', age: 25, is_banned: false, phone: '0501234567', sms_consent: false, feedback_sent: false },
          { id: 'p2', display_name: null, age: null, is_banned: false, phone: null, sms_consent: false, feedback_sent: false },
        ],
        error: null,
      }),
    });
    // Second call: event_guest_phones query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/participants');
    const res = await GET(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participants).toHaveLength(2);
    expect(body.participants[0].profile_complete).toBe(true);
    expect(body.participants[1].profile_complete).toBe(false);
  });

  it('GET returns 500 on DB error', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/participants');
    const res = await GET(req, params('e1'));
    expect(res.status).toBe(500);
  });

  it('PATCH bans participant and syncs banned_devices', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);
    const { evictBanCache } = await import('@/lib/route-helpers');

    // update participant ban status
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    // select participant fingerprints
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { device_fingerprint: 'fp1', hardware_fingerprint: 'hw1' },
      error: null,
    }));
    // upsert banned_devices (2 fingerprints)
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));
    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: null }));

    const req = new NextRequest('http://localhost/api/admin/events/e1/participants', {
      method: 'PATCH',
      body: JSON.stringify({ participantId: 'p1', is_banned: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, params('e1'));
    expect(res.status).toBe(200);
    expect(evictBanCache).toHaveBeenCalledWith('p1');
  });

  it('PATCH returns 400 for missing fields', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/admin/events/e1/participants', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, params('e1'));
    expect(res.status).toBe(400);
  });

  it('PATCH returns 400 for non-boolean is_banned', async () => {
    const req = new NextRequest('http://localhost/api/admin/events/e1/participants', {
      method: 'PATCH',
      body: JSON.stringify({ participantId: 'p1', is_banned: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, params('e1'));
    expect(res.status).toBe(400);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/archive
   ═══════════════════════════════════════════════════════════════════ */
describe('POST /api/admin/events/[eventId]/archive', () => {
  let handler: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/archive/route');
    handler = mod.POST;
  });

  it('returns 404 when event not found', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce(createQueryMock({ data: null, error: { message: 'not found' } }));

    const req = new NextRequest('http://localhost/api/admin/events/e1/archive', { method: 'POST' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is already archived', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { id: 'e1', status: 'archived', name: 'Done Event' },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/admin/events/e1/archive', { method: 'POST' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(400);
  });

  it('I-ADM-ARC-03: returns 401 when not admin', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/events/e1/archive', { method: 'POST' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(401);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/delete
   ═══════════════════════════════════════════════════════════════════ */
describe('DELETE /api/admin/events/[eventId]/delete', () => {
  let handler: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/delete/route');
    handler = mod.DELETE;
  });

  it('returns 401 when not admin', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/events/e1/delete', { method: 'DELETE' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 500 when participants query fails', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/delete', { method: 'DELETE' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(500);
  });

  it('cascade-deletes event and all related data', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);
    const { evictEventStatusCache } = await import('@/lib/route-helpers');

    // participants query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null }),
    });
    // participant_photos query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ storage_path: 'e1/p1/photo.jpg' }], error: null }),
    });
    // delete participant_photos
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    });
    // conversations query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }], error: null }),
    });
    // messages media query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    // delete messages
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    });
    // delete conversations
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    // 6 parallel deletes (likes, blocks, banned_devices, notifications, activity_log, snapshots)
    for (let i = 0; i < 6; i++) {
      mockFrom.mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    }
    // delete participants
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    // delete event
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/delete', { method: 'DELETE' });
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(evictEventStatusCache).toHaveBeenCalledWith('e1');
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/background
   ═══════════════════════════════════════════════════════════════════ */
describe('background image management', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/background/route');
    POST = mod.POST;
    DELETE = mod.DELETE;
  });

  it('POST rejects request with no file', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    const formData = new FormData();
    const req = new NextRequest('http://localhost/api/admin/events/e1/background', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req, params('e1'));
    expect(res.status).toBe(400);
  });

  it('POST rejects non-image MIME type', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    const formData = new FormData();
    formData.append('file', new File(['data'], 'test.pdf', { type: 'application/pdf' }));
    const req = new NextRequest('http://localhost/api/admin/events/e1/background', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req, params('e1'));
    expect(res.status).toBe(400);
  });

  it('I-ADM-BG-03: POST uploads image successfully', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);
    const { validateImageMagicBytes } = await import('@/lib/validations');
    vi.mocked(validateImageMagicBytes).mockReturnValue(true);

    // Storage: remove old backgrounds (returns empty list - no old files)
    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
      remove: mockStorageRemove,
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    // DB update: set background_image on event
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const file = new File([new Uint8Array(10)], 'bg.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);
    const req = new NextRequest('http://localhost/api/admin/events/e1/background', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.background_image).toBeDefined();
  });

  it('DELETE removes background and clears DB', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    // update events set background_image = null
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/background', { method: 'DELETE' });
    const res = await DELETE(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockStorageRemove).toHaveBeenCalled();
  });

  it('DELETE returns 500 on DB error', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB down' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/background', { method: 'DELETE' });
    const res = await DELETE(req, params('e1'));
    expect(res.status).toBe(500);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   events/[eventId]/analytics
   ═══════════════════════════════════════════════════════════════════ */
describe('GET /api/admin/events/[eventId]/analytics', () => {
  let handler: (req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/events/[eventId]/analytics/route');
    handler = mod.GET;
  });

  it('returns 401 when not admin', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/events/e1/analytics');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(401);
  });

  it('serves snapshot for archived event', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    // event lookup → archived
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { status: 'archived' },
      error: null,
    }));
    // snapshot lookup
    mockFrom.mockReturnValueOnce(createQueryMock({
      data: { snapshot: { totalParticipants: 42, totalLikes: 100 } },
      error: null,
    }));

    const req = new NextRequest('http://localhost/api/admin/events/e1/analytics');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalParticipants).toBe(42);
  });

  it('returns 404 when archived event has no snapshot', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce(createQueryMock({ data: { status: 'archived' }, error: null }));
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { snapshot: null }, error: null }));

    const req = new NextRequest('http://localhost/api/admin/events/e1/analytics');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 500 when event lookup fails', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
    });

    const req = new NextRequest('http://localhost/api/admin/events/e1/analytics');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(500);
  });

  it('computes live analytics for active event', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    // event lookup → active
    mockFrom.mockReturnValueOnce(createQueryMock({ data: { status: 'active' }, error: null }));

    // 7 parallel queries (participants, photos, likes, conversations, messages, blocks, activity_log)
    const emptyQuery = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    for (let i = 0; i < 7; i++) {
      mockFrom.mockReturnValueOnce(emptyQuery());
    }

    const req = new NextRequest('http://localhost/api/admin/events/e1/analytics');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalParticipants).toBe(0);
    expect(body.totalLikes).toBe(0);
    expect(body.totalMatches).toBe(0);
  });

  it('returns 500 when analytics queries fail', async () => {
    const { isValidUUID } = await import('@/lib/session');
    vi.mocked(isValidUUID).mockReturnValue(true);

    // event lookup → active
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { status: 'active' }, error: null }),
    });

    // All 7 queries fail
    const failQuery = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB err' } }),
    });

    for (let i = 0; i < 7; i++) {
      mockFrom.mockReturnValueOnce(failQuery());
    }

    const req = new NextRequest('http://localhost/api/admin/events/e1/analytics');
    const res = await handler(req, params('e1'));
    expect(res.status).toBe(500);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   global-analytics
   ═══════════════════════════════════════════════════════════════════ */
describe('GET /api/admin/global-analytics', () => {
  let handler: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import('@/app/api/admin/global-analytics/route');
    handler = mod.GET;
  });

  it('returns 401 when not admin', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/global-analytics');
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns 500 when any query has errors', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);

    // 8 parallel queries; first one fails
    const failQuery = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB err' } }),
    });
    const okQuery = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockFrom
      .mockReturnValueOnce(failQuery())  // events fails
      .mockReturnValueOnce(okQuery())
      .mockReturnValueOnce(okQuery())
      .mockReturnValueOnce(okQuery())
      .mockReturnValueOnce(okQuery())
      .mockReturnValueOnce(okQuery())
      .mockReturnValueOnce(okQuery())
      .mockReturnValueOnce(okQuery());

    const req = new NextRequest('http://localhost/api/admin/global-analytics');
    const res = await handler(req);
    expect(res.status).toBe(500);
  });

  it('returns analytics data when all queries succeed', async () => {
    const { verifyAdminFromRequest } = await import('@/lib/admin-auth');
    vi.mocked(verifyAdminFromRequest).mockReturnValue(true);

    // 8 queries: events, participants, photos, likes, conversations, messages, blocks, snapshots
    const makeQuery = (data: unknown[] = []) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error: null }),
    });

    mockFrom
      .mockReturnValueOnce(makeQuery([{ id: 'e1', name: 'Test', event_type: 'dating', status: 'active', created_at: '2024-01-01T00:00:00Z', archived_at: null }]))
      .mockReturnValueOnce(makeQuery([{ id: 'p1', event_id: 'e1', gender: 'male', attracted_to: 'women', age: 25, display_name: 'John', created_at: '2024-01-01T01:00:00Z' }]))
      .mockReturnValueOnce(makeQuery([]))  // photos
      .mockReturnValueOnce(makeQuery([]))  // likes
      .mockReturnValueOnce(makeQuery([]))  // conversations
      .mockReturnValueOnce(makeQuery([]))  // messages
      .mockReturnValueOnce(makeQuery([]))  // blocks
      .mockReturnValueOnce(makeQuery([])); // snapshots

    const req = new NextRequest('http://localhost/api/admin/global-analytics');
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEvents).toBe(1);
    expect(body.totalParticipants).toBe(1);
    expect(body.totalMen).toBe(1);
  });
});
