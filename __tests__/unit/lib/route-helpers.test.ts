/**
 * Unit tests for lib/route-helpers.ts - secureGuard, jsonError, isSafePath, caches
 * Tests: U-RTH-01 through U-RTH-20+
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jsonError, isSafePath, evictBanCache, evictEventStatusCache, verifyCronAuth } from '@/lib/route-helpers';

describe('verifyCronAuth', () => {
  const ORIGINAL = process.env.CRON_SECRET;
  afterEach(() => { process.env.CRON_SECRET = ORIGINAL; });

  const reqWith = (auth?: string) =>
    new Request('http://localhost/api/cron', auth ? { headers: { authorization: auth } } : undefined);

  it('returns false (fail-closed) when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth(reqWith('Bearer anything'))).toBe(false);
  });

  it('returns true for a matching Bearer token', () => {
    process.env.CRON_SECRET = 'super-secret-value';
    expect(verifyCronAuth(reqWith('Bearer super-secret-value'))).toBe(true);
  });

  it('returns false for a wrong token', () => {
    process.env.CRON_SECRET = 'super-secret-value';
    expect(verifyCronAuth(reqWith('Bearer wrong-value'))).toBe(false);
  });

  it('returns false when the Authorization header is missing', () => {
    process.env.CRON_SECRET = 'super-secret-value';
    expect(verifyCronAuth(reqWith())).toBe(false);
  });

  it('does not match a raw token without the Bearer prefix', () => {
    process.env.CRON_SECRET = 'super-secret-value';
    expect(verifyCronAuth(reqWith('super-secret-value'))).toBe(false);
  });
});

describe('jsonError', () => {
  it('U-RTH-01: returns NextResponse with correct status', () => {
    const res = jsonError('Not found', 404);
    expect(res.status).toBe(404);
  });

  it('U-RTH-02: body contains error message', async () => {
    const res = jsonError('Forbidden', 403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 status', () => {
    expect(jsonError('Bad request', 400).status).toBe(400);
  });

  it('returns 500 status', () => {
    expect(jsonError('Internal error', 500).status).toBe(500);
  });

  it('returns 401 status', () => {
    expect(jsonError('Unauthorized', 401).status).toBe(401);
  });

  it('returns 413 status', () => {
    expect(jsonError('Payload too large', 413).status).toBe(413);
  });

  it('returns 429 status', () => {
    expect(jsonError('Too many requests', 429).status).toBe(429);
  });
});

describe('isSafePath', () => {
  it('U-RTH-07: allows simple path', () => {
    expect(isSafePath('photos/abc.jpg')).toBe(true);
  });

  it('U-RTH-08: allows path with UUID segments', () => {
    expect(isSafePath('event-123/user-456/photo.webp')).toBe(true);
  });

  it('U-RTH-09: rejects path traversal (..)', () => {
    expect(isSafePath('../etc/passwd')).toBe(false);
  });

  it('U-RTH-10: rejects encoded path traversal', () => {
    expect(isSafePath('..%2F..%2Fetc%2Fpasswd')).toBe(false);
  });

  it('U-RTH-11: rejects double slashes', () => {
    expect(isSafePath('photos//hidden.jpg')).toBe(false);
  });

  it('U-RTH-12: rejects backslashes', () => {
    expect(isSafePath('photos\\hidden.jpg')).toBe(false);
  });

  it('U-RTH-13: rejects null bytes', () => {
    expect(isSafePath('photo\0.jpg')).toBe(false);
  });

  it('U-RTH-14: rejects absolute paths (Unix)', () => {
    expect(isSafePath('/etc/passwd')).toBe(false);
  });

  it('U-RTH-15: rejects absolute paths (Windows)', () => {
    expect(isSafePath('C:\\Users\\file.txt')).toBe(false);
  });

  it('rejects drive letters lowercase', () => {
    expect(isSafePath('d:/file.txt')).toBe(false);
  });

  it('allows simple filename', () => {
    expect(isSafePath('file.jpg')).toBe(true);
  });

  it('allows nested safe path', () => {
    expect(isSafePath('a/b/c/d/e/file.png')).toBe(true);
  });

  it('rejects encoded null byte', () => {
    expect(isSafePath('photo%00.jpg')).toBe(false);
  });

  it('rejects malformed percent encoding', () => {
    expect(isSafePath('file%ZZname')).toBe(false);
  });

  it('allows path with dots in filename', () => {
    expect(isSafePath('photo.backup.jpg')).toBe(true);
  });

  it('rejects .. in middle of path', () => {
    expect(isSafePath('photos/../../../etc/passwd')).toBe(false);
  });
});

describe('evictBanCache', () => {
  it('U-RTH-16: does not throw', () => {
    expect(() => evictBanCache('some-participant-id')).not.toThrow();
  });

  it('handles empty string', () => {
    expect(() => evictBanCache('')).not.toThrow();
  });
});

describe('evictEventStatusCache', () => {
  it('U-RTH-17: does not throw', () => {
    expect(() => evictEventStatusCache('some-event-id')).not.toThrow();
  });

  it('handles empty string', () => {
    expect(() => evictEventStatusCache('')).not.toThrow();
  });
});

/* ── secureGuard tests ─────────────────────────────── */
describe('secureGuard', () => {
  // We import secureGuard and mock its dependencies
  const mockGetSessionFromRequest = vi.fn();
  const mockCheckCsrf = vi.fn();
  const mockCheckRateLimit = vi.fn();
  const mockGetClientIp = vi.fn();
  const mockGetServiceClient = vi.fn();
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  // Use dynamic import to have mocks take effect
  let secureGuard: typeof import('@/lib/route-helpers').secureGuard;
  let getSessionEpoch: typeof import('@/lib/route-helpers').getSessionEpoch;
  let bumpSessionEpoch: typeof import('@/lib/route-helpers').bumpSessionEpoch;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset module so mocks are fresh each test
    vi.doMock('@/lib/session', () => ({
      getSessionFromRequest: mockGetSessionFromRequest,
      checkCsrf: mockCheckCsrf,
    }));
    vi.doMock('@/lib/rate-limit', () => ({
      checkRateLimit: mockCheckRateLimit,
      // secureGuard awaits the distributed limiter; point it at the same mock.
      // Awaiting a plain (non-promise) return value resolves to that value.
      checkRateLimitAsync: mockCheckRateLimit,
      getClientIp: mockGetClientIp,
    }));
    vi.doMock('@/lib/supabase', () => ({
      getServiceClient: mockGetServiceClient,
    }));
    vi.doMock('@/lib/logger', () => ({
      logger: mockLogger,
    }));

    // Default mock config
    const configValues = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
    vi.doMock('@/lib/config', () => configValues);

    const mod = await import('@/lib/route-helpers');
    secureGuard = mod.secureGuard;
    getSessionEpoch = mod.getSessionEpoch;
    bumpSessionEpoch = mod.bumpSessionEpoch;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/session');
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/supabase');
    vi.doUnmock('@/lib/logger');
    vi.doUnmock('@/lib/config');
  });

  const validSession = {
    typ: 'session' as const,
    sub: '10000000-1000-4000-8000-000000000001',
    eid: '10000000-1000-4000-8000-000000000002',
    esl: 'test-event',
    enm: 'Test Event',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const rateLimit = { max: 60, windowMs: 60000 };

  function makeReq(method = 'POST') {
    return new Request('http://localhost/api/secure/test', { method });
  }

  it('U-RTH-05: valid session + CSRF + not banned + active event → returns session', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue(validSession);
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: true });

    // Both the ban check (participants) and the event-status check (events) use
    // .eq().maybeSingle(); differentiate the resolved row by table name.
    const mockSb = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              table === 'events'
                ? { data: { status: 'active' }, error: null }
                : { data: { is_banned: false }, error: null }
            ),
          }),
        }),
      })),
    };
    mockGetServiceClient.mockReturnValue(mockSb);

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    // Should return session payload, not a Response
    expect(result).toHaveProperty('sub', validSession.sub);
  });

  it('U-RTH-06: missing session cookie → 401', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue(null);

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 401);
  });

  it('U-RTH-07: invalid session token → 401', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue(null);

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 401);
  });

  it('U-RTH-08: missing CSRF header → 403', async () => {
    mockCheckCsrf.mockReturnValue(false);

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 403);
  });

  it('U-RTH-09: banned participant → 403', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue(validSession);
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: true });

    const mockSb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { is_banned: true }, error: null }),
          }),
        }),
      }),
    };
    mockGetServiceClient.mockReturnValue(mockSb);

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 403);
  });

  it('U-RTH-11: event not active → 410', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue(validSession);
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: true });

    // Ban check (participants) returns not-banned; event-status (events) returns paused.
    // Both use .eq().maybeSingle(); differentiate by table name.
    const mockSb = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              table === 'events'
                ? { data: { status: 'paused' }, error: null }
                : { data: { is_banned: false }, error: null }
            ),
          }),
        }),
      })),
    };
    mockGetServiceClient.mockReturnValue(mockSb);

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 410);
  });

  it('U-RTH-14: rate limited → 429', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue(validSession);
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: false, resetMs: 30000 });

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 429);
  });

  it('U-RTH-body: rejects oversized Content-Length → 413', async () => {
    const req = new Request('http://localhost/api/secure/test', {
      method: 'POST',
      headers: { 'content-length': '999999999' },
    });

    const result = await secureGuard(req as any, 'test', rateLimit, { maxBodyBytes: 1024 });
    expect(result).toHaveProperty('status', 413);
  });

  /* ── session_epoch revocation (migration 039) ── */

  // Builds a service-client mock where participants rows carry is_banned + session_epoch,
  // and events return a status. When epochColumnMissing is set, the combined
  // `is_banned, session_epoch` select errors (simulating pre-migration schema) and the
  // code falls back to an `is_banned`-only select.
  function makeSbWithEpoch(
    participantRow: Record<string, unknown>,
    eventStatus = 'active',
    epochColumnMissing = false,
  ) {
    return {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockImplementation((cols: string) => ({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => {
              if (table === 'events') return Promise.resolve({ data: { status: eventStatus }, error: null });
              if (epochColumnMissing && String(cols).includes('session_epoch')) {
                return Promise.resolve({ data: null, error: { message: 'column "session_epoch" does not exist' } });
              }
              return Promise.resolve({ data: participantRow, error: null });
            }),
          }),
        })),
      })),
    };
  }

  it('revokes a session whose sep is older than the current epoch → 401', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue({ ...validSession, sep: 1 });
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetServiceClient.mockReturnValue(makeSbWithEpoch({ is_banned: false, session_epoch: 5 }));

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('status', 401);
  });

  it('accepts a session whose sep matches the current epoch', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue({ ...validSession, sep: 5 });
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetServiceClient.mockReturnValue(makeSbWithEpoch({ is_banned: false, session_epoch: 5 }));

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('sub', validSession.sub);
  });

  it('does not reject when the session_epoch column is absent (migration skew is fail-open on epoch)', async () => {
    mockCheckCsrf.mockReturnValue(true);
    mockGetSessionFromRequest.mockReturnValue({ ...validSession, sep: 1 });
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockGetServiceClient.mockReturnValue(makeSbWithEpoch({ is_banned: false }, 'active', true));

    const result = await secureGuard(makeReq() as any, 'test', rateLimit);
    expect(result).toHaveProperty('sub', validSession.sub);
  });

  it('getSessionEpoch returns the DB value, defaulting to 1 when absent', async () => {
    mockGetServiceClient.mockReturnValue(makeSbWithEpoch({ session_epoch: 9 }));
    expect(await getSessionEpoch('p1')).toBe(9);

    mockGetServiceClient.mockReturnValue(makeSbWithEpoch({}, 'active', true));
    expect(await getSessionEpoch('p2')).toBe(1);
  });

  it('bumpSessionEpoch calls the increment_session_epoch RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    mockGetServiceClient.mockReturnValue({ rpc: mockRpc });
    await bumpSessionEpoch('p1');
    expect(mockRpc).toHaveBeenCalledWith('increment_session_epoch', { p_participant_id: 'p1' });
  });
});
