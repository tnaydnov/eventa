import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockFrom = vi.hoisted(() => vi.fn());
const mockInsert = vi.fn().mockReturnValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({ error: null }),
});

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/route-helpers', () => ({
  secureGuard: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { standard: { max: 60, windowMs: 60000 } },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from '@/app/api/secure/heartbeat/route';
import { secureGuard } from '@/lib/route-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createQueryMock } from '../../helpers/supabase-mock';

describe('POST /api/secure/heartbeat', () => {
  const mockSession = { sub: 'p1', eid: 'e1', role: 'participant' };
  let participantsBuilder: ReturnType<typeof createQueryMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();

    // Default: secureGuard passes
    (secureGuard as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

    // Default from() behavior. The route selects via .maybeSingle() and fires a
    // thenable .update().eq() chain, so use the shared builder. We expose the
    // participants builder so a test can assert whether .update() was called.
    participantsBuilder = createQueryMock({
      data: { last_seen_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), tab_visible: false },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'participants') return participantsBuilder;
      return createQueryMock({ data: null, error: null });
    });
  });

  it('I-HRT-01: valid session → updates last_seen_at (stale participant)', async () => {
    const req = new NextRequest('http://localhost/api/secure/heartbeat', { method: 'POST' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('participants');
    expect(mockFrom).toHaveBeenCalledWith('activity_log');
  });

  it('I-HRT-02: recent last_seen_at (within 2 min) → no update fired', async () => {
    // Recent + tab_visible already false (matches no tabVisible in body) → no update.
    participantsBuilder = createQueryMock({
      data: { last_seen_at: new Date().toISOString(), tab_visible: false },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'participants') return participantsBuilder;
      return createQueryMock({ data: null, error: null });
    });

    const req = new NextRequest('http://localhost/api/secure/heartbeat', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // update should NOT be called since participant is recent and tab state unchanged
    expect(participantsBuilder.update).not.toHaveBeenCalled();
  });

  it('I-HRT-03: no session → returns guard response', async () => {
    (secureGuard as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const req = new NextRequest('http://localhost/api/secure/heartbeat', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('I-HRT-04: DB error → returns 500', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('DB down');
    });

    const req = new NextRequest('http://localhost/api/secure/heartbeat', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
