/**
 * Unit tests for lib/api/profile.ts — updateProfile, getParticipant
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
    const participant = { id: 'p1', name: 'Dan' };
    const photos = [{ id: 'ph1', storage_path: 'path.jpg' }];
    // First from() call: participants
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: participant, error: null }),
    });
    // Second from() call: participant_photos
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: photos, error: null }),
    });

    const result = await getParticipant('p1');
    expect(result).toEqual({ ...participant, photos });
  });

  it('returns null when participant not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    expect(await getParticipant('missing')).toBeNull();
  });

  it('returns null on error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    expect(await getParticipant('p1')).toBeNull();
  });
});
