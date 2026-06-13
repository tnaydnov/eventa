/**
 * Unit tests for lib/cron-heartbeat.ts - heartbeat recording, wrapper, staleness.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  recordCronHeartbeat,
  withCronHeartbeat,
  getCronHealth,
  CRON_INTERVAL_MINUTES,
} from '@/lib/cron-heartbeat';

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

const makeReq = () => new NextRequest('http://localhost/api/cron/test');

describe('recordCronHeartbeat', () => {
  it('calls record_cron_heartbeat RPC with the job, status, duration and truncated error', async () => {
    await recordCronHeartbeat('dispatch-sms', { status: 'success', durationMs: 42 });
    expect(mockRpc).toHaveBeenCalledWith('record_cron_heartbeat', {
      p_job_name: 'dispatch-sms',
      p_status: 'success',
      p_duration_ms: 42,
      p_error: null,
    });
  });

  it('truncates long error messages to 500 chars', async () => {
    const long = 'x'.repeat(900);
    await recordCronHeartbeat('cleanup', { status: 'error', error: long });
    const arg = mockRpc.mock.calls[0][1];
    expect(arg.p_error).toHaveLength(500);
    expect(arg.p_status).toBe('error');
  });

  it('never throws when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(recordCronHeartbeat('cleanup', { status: 'success' })).resolves.toBeUndefined();
  });

  it('never throws when the client throws synchronously', async () => {
    mockRpc.mockImplementation(() => { throw new Error('no client'); });
    await expect(recordCronHeartbeat('cleanup', { status: 'success' })).resolves.toBeUndefined();
  });
});

describe('withCronHeartbeat', () => {
  it('returns the handler response unchanged and records success for a 2xx', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }));
    const wrapped = withCronHeartbeat('send-reports', handler);
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'record_cron_heartbeat',
      expect.objectContaining({ p_job_name: 'send-reports', p_status: 'success' }),
    );
  });

  it('records error for a 5xx response', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ error: 'x' }, { status: 500 }));
    await withCronHeartbeat('send-reports', handler)(makeReq());
    expect(mockRpc).toHaveBeenCalledWith(
      'record_cron_heartbeat',
      expect.objectContaining({ p_status: 'error' }),
    );
  });

  it('records skipped for a 4xx response (ran but did no work)', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ error: 'auth' }, { status: 401 }));
    await withCronHeartbeat('send-reports', handler)(makeReq());
    expect(mockRpc).toHaveBeenCalledWith(
      'record_cron_heartbeat',
      expect.objectContaining({ p_status: 'skipped' }),
    );
  });

  it('records error and re-throws when the handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('kaboom'));
    await expect(withCronHeartbeat('cleanup', handler)(makeReq())).rejects.toThrow('kaboom');
    expect(mockRpc).toHaveBeenCalledWith(
      'record_cron_heartbeat',
      expect.objectContaining({ p_status: 'error', p_error: 'kaboom' }),
    );
  });
});

describe('getCronHealth', () => {
  const now = Date.parse('2026-06-12T12:00:00Z');

  it('flags a job with no recorded success as stale', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });
    const { healthy, crons } = await getCronHealth(now);
    expect(healthy).toBe(false);
    expect(crons.every((c) => c.stale)).toBe(true);
    // Every known scheduled job is represented even with no rows.
    expect(crons).toHaveLength(Object.keys(CRON_INTERVAL_MINUTES).length);
  });

  it('treats a recent success as fresh', async () => {
    const rows = Object.keys(CRON_INTERVAL_MINUTES).map((job) => ({
      job_name: job,
      last_run_at: new Date(now - 1000).toISOString(),
      last_success_at: new Date(now - 1000).toISOString(),
      last_status: 'success',
      last_error: null,
    }));
    mockSelect.mockResolvedValue({ data: rows, error: null });
    const { healthy, crons } = await getCronHealth(now);
    expect(healthy).toBe(true);
    expect(crons.every((c) => !c.stale)).toBe(true);
  });

  it('flags an hourly job stale once its last success exceeds interval × grace', async () => {
    // 'send-reports' is hourly (60 min); grace ×3 = 180 min. 4h old → stale.
    const rows = [{
      job_name: 'send-reports',
      last_run_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      last_success_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      last_status: 'success',
      last_error: null,
    }];
    mockSelect.mockResolvedValue({ data: rows, error: null });
    const { crons } = await getCronHealth(now);
    expect(crons.find((c) => c.jobName === 'send-reports')!.stale).toBe(true);
  });

  it('returns healthy (does not page) when the heartbeat table read fails', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'db down' } });
    const { healthy, crons } = await getCronHealth(now);
    expect(healthy).toBe(true);
    expect(crons).toEqual([]);
  });
});
