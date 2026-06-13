/**
 * Unit tests for lib/api/grid.ts - getGridParticipants
 * The function now delegates to /api/secure/participants (server-side decryption).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getGridParticipants } from '@/lib/api/grid';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getGridParticipants', () => {
  it('returns empty array on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));
    const result = await getGridParticipants('e1', 'me');
    expect(result).toEqual([]);
  });

  it('returns empty array on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const result = await getGridParticipants('e1', 'me');
    expect(result).toEqual([]);
  });

  it('returns participants from API response', async () => {
    const participants = [
      { id: 'p1', display_name: 'Alice', gender: 'female', attracted_to: 'men', age: 25, bio: null, looking_for: null, photos: [] },
      { id: 'p2', display_name: 'Bob', gender: 'male', attracted_to: 'women', age: 28, bio: null, looking_for: null, photos: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => participants,
    } as Response);

    const result = await getGridParticipants('e1', 'me');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('p1');
  });

  it('calls the correct endpoint', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await getGridParticipants('event-abc', 'me');
    expect(spy).toHaveBeenCalledWith('/api/secure/participants?eventId=event-abc');
  });

  it('returns empty array on empty response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await getGridParticipants('e1', 'me');
    expect(result).toEqual([]);
  });
});
