/**
 * Unit tests for lib/api/profile.ts - updateProfile, getParticipant
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/api/helpers', () => ({
  PARTICIPANT_COLUMNS: 'id, name, bio',
  PHOTO_COLUMNS: 'id, storage_path',
}));

import { updateProfile, getParticipant } from '@/lib/api/profile';

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
});

// ---------- updateProfile ----------
describe('updateProfile', () => {
  it('returns updated participant on success', async () => {
    const updated = { id: 'p1', name: 'New' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    } as Response);

    const result = await updateProfile('p1', { name: 'New' });
    expect(result).toEqual(updated);
  });

  it('returns null on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      text: async () => 'error',
    } as any);
    expect(await updateProfile('p1', { name: 'X' })).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await updateProfile('p1', { name: 'X' })).toBeNull();
  });

  it('sends PATCH with profile data', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const data = { name: 'Test', bio: 'hello' };
    await updateProfile('p1', data);
    expect(spy).toHaveBeenCalledWith('/api/secure/profile', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify(data),
    }));
  });
});

// ---------- getParticipant ----------
describe('getParticipant', () => {
  it('returns participant data with photos on success', async () => {
    const result = { id: 'p1', name: 'Dan', photos: [{ id: 'ph1', storage_path: 'path.jpg' }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => result,
    } as Response);

    const p = await getParticipant('p1');
    expect(p).toEqual(result);
  });

  it('returns null when participant not found (null response)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    } as Response);

    expect(await getParticipant('missing')).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    expect(await getParticipant('p1')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));
    expect(await getParticipant('p1')).toBeNull();
  });
});
