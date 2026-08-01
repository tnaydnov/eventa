/**
 * Unit tests for lib/api/likes.ts - sendLike, removeLike, markLikeSeen, markAllLikesSeen
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/api/helpers', () => ({
  getBlockedIds: vi.fn().mockResolvedValue(new Set()),
  buildParticipantPhotoMaps: vi.fn().mockResolvedValue({ pMap: new Map(), phMap: new Map() }),
  LIKE_COLUMNS: 'id, event_id, from_participant_id, to_participant_id, created_at, seen_at',
}));

import { sendLike, removeLike, markLikeSeen, markAllLikesSeen } from '@/lib/api/likes';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('sendLike', () => {
  it('returns like data on success', async () => {
    const likeData = { id: 'l1', match: false };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => likeData,
    } as Response);

    const result = await sendLike('target-id');
    expect(result).toEqual(likeData);
  });

  it('returns null on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await sendLike('target-id')).toBeNull();
  });

  it('treats 409 as duplicate success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 409 } as Response);
    await expect(sendLike('target-id')).resolves.toEqual({ duplicate: true });
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await sendLike('target-id')).toBeNull();
  });

  it('sends correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await sendLike('p2');
    expect(spy).toHaveBeenCalledWith('/api/secure/likes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ toId: 'p2' }),
    }));
  });
});

describe('removeLike', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    expect(await removeLike('p2')).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await removeLike('p2')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await removeLike('p2')).toBe(false);
  });
});

describe('markLikeSeen', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    expect(await markLikeSeen('p2')).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await markLikeSeen('p2')).toBe(false);
  });

  it('sends correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    await markLikeSeen('from-id');
    expect(spy).toHaveBeenCalledWith('/api/secure/likes/seen', expect.objectContaining({
      body: JSON.stringify({ fromParticipantId: 'from-id' }),
    }));
  });
});

describe('markAllLikesSeen', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    expect(await markAllLikesSeen()).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await markAllLikesSeen()).toBe(false);
  });

  it('sends all:true in body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    await markAllLikesSeen();
    expect(spy).toHaveBeenCalledWith('/api/secure/likes/seen', expect.objectContaining({
      body: JSON.stringify({ all: true }),
    }));
  });
});
