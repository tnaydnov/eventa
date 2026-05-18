/**
 * Integration tests for /api/portal/[token]/report/pdf
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/portal/[token]/report/pdf/route';

const token = 'valid-token-1234';
const eventId = '11111111-1111-1111-1111-111111111111';

function mockTokenLookup(data: unknown, error: unknown = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });
}

function mockEventLookup(data: unknown, error: unknown = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });
}

function mockReportLookup(data: unknown, error: unknown = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/portal/[token]/report/pdf', () => {
  it('returns 400 for invalid token length', async () => {
    const req = new NextRequest('http://localhost/api/portal/a/report/pdf');
    const res = await GET(req, { params: Promise.resolve({ token: 'a' }) });

    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 404 for invalid/expired token', async () => {
    mockTokenLookup(null);

    const req = new NextRequest(`http://localhost/api/portal/${token}/report/pdf`);
    const res = await GET(req, { params: Promise.resolve({ token }) });

    expect(res.status).toBe(404);
  });

  it('returns 404 when report does not exist', async () => {
    mockTokenLookup({ event_id: eventId });
    mockEventLookup({ name: 'Summer Event' });
    mockReportLookup(null);

    const req = new NextRequest(`http://localhost/api/portal/${token}/report/pdf`);
    const res = await GET(req, { params: Promise.resolve({ token }) });

    expect(res.status).toBe(404);
  });

  it('returns PDF when token and report are valid', async () => {
    mockTokenLookup({ event_id: eventId });
    mockEventLookup({ name: 'Summer Event' });
    mockReportLookup({
      curated_payload: {
        schema_version: 1,
        generated_at: '2026-05-17T12:00:00.000Z',
        event_id: eventId,
        engagement: {
          total_likes: 44,
          mutual_likes: 12,
          match_rate: 27.3,
          total_conversations: 9,
          total_messages: 78,
        },
        funnel: {
          steps: [{ step: 'join_started', count: 30 }],
          top_drop_off: null,
        },
        time_dynamics: { hourly_activity: [], peak_hour: null },
        network: { total_participants: 30 },
        crosstabs: { gender_distribution: [], age_buckets: [] },
        safety: { total_blocks: 0, total_reports: 0, banned_participants: 0 },
      },
      ai_summary: 'Healthy participation.',
    });

    const req = new NextRequest(`http://localhost/api/portal/${token}/report/pdf`);
    const res = await GET(req, { params: Promise.resolve({ token }) });
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('attachment; filename=');
    expect(body.toString('latin1', 0, 8)).toContain('%PDF-1.4');
  });
});
