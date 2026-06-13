/**
 * Unit tests for lib/otp.ts
 * Tests: OTP generation (6 digits, crypto-secure), code comparison
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock dependencies ──────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/config', () => ({
  OTP_LENGTH: 6,
  OTP_EXPIRY_S: 300,
  OTP_MAX_ATTEMPTS: 3,
  OTP_RESEND_COOLDOWN_S: 45,
}));

import { generateOtpCode, createOtp, verifyOtp, cleanupExpiredOtps } from '@/lib/otp';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── generateOtpCode ────────────────────────────────────

describe('generateOtpCode', () => {
  it('generates a 6-digit code by default', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates a code with specified length', () => {
    const code = generateOtpCode(4);
    expect(code).toMatch(/^\d{4}$/);
  });

  it('generates a code with 8 digits', () => {
    const code = generateOtpCode(8);
    expect(code).toMatch(/^\d{8}$/);
  });

  it('generates numeric-only codes (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      // No leading zeros in the value (first digit is never 0)
      expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code)).toBeLessThan(1000000);
    }
  });

  it('generates unique codes (high probability)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateOtpCode());
    }
    // With 900,000 possible 6-digit codes, 100 should all be unique
    expect(codes.size).toBe(100);
  });
});

// ─── createOtp ──────────────────────────────────────────

describe('createOtp', () => {
  const phone = '+972501234567';
  const eventId = '123e4567-e89b-12d3-a456-426614174000';

  it('creates OTP successfully when no cooldown active', async () => {
    // No recent OTP - cooldown check returns null
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
      }),
    });

    // Invalidate previous OTPs
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    // Insert new OTP
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'otp_verifications') {
        // Track call count to differentiate select/update/insert
        const callCount = mockFrom.mock.calls.filter(
          (c: string[]) => c[0] === 'otp_verifications'
        ).length;
        if (callCount === 1) return { select: mockSelect };
        if (callCount === 2) return { update: mockUpdate };
        return { insert: mockInsert };
      }
      return {};
    });

    const result = await createOtp(phone, eventId);
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('expiresIn', 300);
    if ('code' in result) {
      expect(result.code).toMatch(/^\d{6}$/);
    }
  });

  it('returns error when cooldown is active', async () => {
    // Recent OTP exists - cooldown active
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'existing-otp-id' },
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await createOtp(phone, eventId);
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toContain('45 seconds');
    }
  });
});

// ─── verifyOtp ──────────────────────────────────────────

describe('verifyOtp', () => {
  const phone = '+972501234567';
  const eventId = '123e4567-e89b-12d3-a456-426614174000';

  function mockOtpLookup(otpData: Record<string, unknown> | null, fetchError: Error | null = null) {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: otpData,
        error: fetchError,
      }),
    };
    // Correctly chain `select → eq → eq → eq → gt → order → limit → maybeSingle`
    const mockSelect = vi.fn().mockReturnValue(selectChain);
    return mockSelect;
  }

  function mockUpdateChain() {
    return {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
  }

  it('returns valid: true for correct code', async () => {
    const otpRecord = { id: 'otp-1', code: '123456', attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: mockOtpLookup(otpRecord) };
      return mockUpdateChain();
    });

    const result = await verifyOtp(phone, eventId, '123456');
    expect(result).toEqual({ valid: true });
  });

  it('returns valid: false for incorrect code', async () => {
    const otpRecord = { id: 'otp-1', code: '123456', attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: mockOtpLookup(otpRecord) };
      return mockUpdateChain();
    });

    const result = await verifyOtp(phone, eventId, '999999');
    expect(result).toEqual({ valid: false, error: 'Incorrect code' });
  });

  it('returns error when OTP not found (expired)', async () => {
    mockFrom.mockReturnValue({ select: mockOtpLookup(null) });

    const result = await verifyOtp(phone, eventId, '123456');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toContain('expired');
    }
  });

  it('returns error when max attempts exceeded', async () => {
    const otpRecord = { id: 'otp-1', code: '123456', attempts: 3, expires_at: new Date(Date.now() + 60000).toISOString() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: mockOtpLookup(otpRecord) };
      return mockUpdateChain();
    });

    const result = await verifyOtp(phone, eventId, '123456');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toContain('Too many attempts');
    }
  });

  it('returns error when DB lookup fails', async () => {
    mockFrom.mockReturnValue({
      select: mockOtpLookup(null, new Error('DB connection failed')),
    });

    const result = await verifyOtp(phone, eventId, '123456');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toBe('Verification failed');
    }
  });
});

// ─── cleanupExpiredOtps ─────────────────────────────────

describe('cleanupExpiredOtps', () => {
  it('returns deleted count on success', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null, count: 5 }),
      }),
    });

    const result = await cleanupExpiredOtps();
    expect(result).toBe(5);
  });

  it('returns 0 on error', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: new Error('fail'), count: null }),
      }),
    });

    const result = await cleanupExpiredOtps();
    expect(result).toBe(0);
  });

  it('returns 0 when count is null', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null, count: null }),
      }),
    });

    const result = await cleanupExpiredOtps();
    expect(result).toBe(0);
  });
});

// ─── OTP hashing at rest (§5.3/§8.3) ────────────────────
import crypto from 'crypto';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

describe('OTP hashing at rest', () => {
  const phone = '+972501234567';
  const eventId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => { delete process.env.OTP_PEPPER; });

  function captureCreateInsert() {
    const captured: { payload?: Record<string, unknown> } = {};
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // cooldown check → no recent OTP
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ gte: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }) }) }) }) };
      }
      if (callCount === 2) {
        // invalidate previous
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }) }) };
      }
      // insert — capture
      return { insert: vi.fn((payload: Record<string, unknown>) => { captured.payload = payload; return Promise.resolve({ error: null }); }) };
    });
    return captured;
  }

  it('stores a 64-char SHA-256 hash, never the plaintext code', async () => {
    const captured = captureCreateInsert();
    const result = await createOtp(phone, eventId);
    const code = (result as { code: string }).code;
    const stored = captured.payload!.code as string;
    expect(stored).toHaveLength(64);
    expect(stored).not.toBe(code);
    expect(stored).toBe(sha256(code));
  });

  it('mixes in OTP_PEPPER when configured', async () => {
    process.env.OTP_PEPPER = 'super-pepper';
    const captured = captureCreateInsert();
    const result = await createOtp(phone, eventId);
    const code = (result as { code: string }).code;
    expect(captured.payload!.code).toBe(sha256(`${code}super-pepper`));
  });

  it('verifies a correct code against a stored hash', async () => {
    const code = '654321';
    const otpRecord = { id: 'o1', code: sha256(code), attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: otpRecord, error: null }) }) };
      }
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
    });
    expect(await verifyOtp(phone, eventId, code)).toEqual({ valid: true });
  });

  it('rejects a wrong code against a stored hash', async () => {
    const otpRecord = { id: 'o1', code: sha256('111111'), attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: otpRecord, error: null }) }) };
      }
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
    });
    expect((await verifyOtp(phone, eventId, '222222')).valid).toBe(false);
  });
});
