/**
 * Integration tests for GET /api/cron/reconcile-payments (SECURITY_HARDENING_PLAN §18).
 * Verifies read-only detection of payment/provider divergence - no payment mutation.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryMock } from '../../helpers/supabase-mock';

const mockFrom = vi.hoisted(() => vi.fn());
const mockGetClearingLogById = vi.hoisted(() => vi.fn());
const mockIsConfigured = vi.hoisted(() => vi.fn(() => true));
const mockAuditLog = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({ getServiceClient: () => ({ from: mockFrom }) }));
vi.mock('@/lib/invoice4u', () => ({
  getClearingLogById: mockGetClearingLogById,
  isConfigured: mockIsConfigured,
}));
vi.mock('@/lib/admin-auth', () => ({ adminAuditLog: mockAuditLog }));
// Heartbeat wrapper is a passthrough in tests (its own DB write is exercised elsewhere).
vi.mock('@/lib/cron-heartbeat', () => ({ withCronHeartbeat: (_name: string, h: unknown) => h }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 5, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { strict: { maxRequests: 10, windowMs: 60000 } },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/cron/reconcile-payments/route';
import { _resetCircuitBreakers } from '@/lib/resilience';

const SECRET = 'test-cron-secret';

function req(auth = `Bearer ${SECRET}`) {
  return new NextRequest('http://localhost/api/cron/reconcile-payments', {
    method: 'GET',
    headers: { authorization: auth },
  });
}

function candidate(payment_status: string, id = 'r1') {
  return { id, payment_status, clearing_log_id: 'CL-1', created_at: '2026-06-01T00:00:00Z' };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCircuitBreakers();
  process.env.CRON_SECRET = SECRET;
  mockIsConfigured.mockReturnValue(true);
});

describe('GET /api/cron/reconcile-payments', () => {
  it('rejects an unauthenticated caller (401)', async () => {
    const res = await GET(req('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('skips when the payment provider is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('flags provider_success_local_unpaid (missed webhook) and audit-logs it', async () => {
    mockFrom.mockReturnValue(createQueryMock({ data: [candidate('pending')], error: null }));
    mockGetClearingLogById.mockResolvedValue({ success: true, data: { isSuccess: true } });

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).mismatches).toBe(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      'PAYMENT_RECONCILE_MISMATCH',
      expect.objectContaining({ type: 'provider_success_local_unpaid', requestId: 'r1' }),
    );
    // Read-only: only the candidate SELECT touched the DB - no update was issued.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('flags local_paid_provider_failed (possible spoof) and audit-logs it', async () => {
    mockFrom.mockReturnValue(createQueryMock({ data: [candidate('paid')], error: null }));
    mockGetClearingLogById.mockResolvedValue({ success: true, data: { isSuccess: false } });

    const res = await GET(req());
    expect((await res.json()).mismatches).toBe(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      'PAYMENT_RECONCILE_MISMATCH',
      expect.objectContaining({ type: 'local_paid_provider_failed' }),
    );
  });

  it('reports no mismatch when local and provider agree', async () => {
    mockFrom.mockReturnValue(createQueryMock({ data: [candidate('paid')], error: null }));
    mockGetClearingLogById.mockResolvedValue({ success: true, data: { isSuccess: true } });

    const res = await GET(req());
    const body = await res.json();
    expect(body.mismatches).toBe(0);
    expect(body.checked).toBe(1);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('skips a candidate whose provider lookup fails, without throwing', async () => {
    mockFrom.mockReturnValue(createQueryMock({ data: [candidate('pending')], error: null }));
    mockGetClearingLogById.mockResolvedValue({ success: false, error: 'provider down' });

    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mismatches).toBe(0);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});
