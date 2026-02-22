/**
 * Unit tests for lib/api/grid.ts - getGridParticipants
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/api/helpers', () => ({
  getBlockedIds: vi.fn().mockResolvedValue(new Set()),
}));

import { getGridParticipants } from '@/lib/api/grid';
import { getBlockedIds } from '@/lib/api/helpers';

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBlockedIds).mockResolvedValue(new Set());
});

describe('getGridParticipants', () => {
  it('returns empty when my profile not found', async () => {
    // myProfile returns null
    mockFrom
      .mockReturnValueOnce(makeChain(null))   // myProfile (via maybeSingle)
      .mockReturnValueOnce(makeChain([]))      // participants
      ;

    // getBlockedIds is mocked separately, so the first mockFrom call = myProfile
    // Actually the function does Promise.all([getBlockedIds, myProfile, participants])
    // getBlockedIds doesn't call mockFrom - it's mocked directly
    // So mockFrom calls: myProfile, participants
    const result = await getGridParticipants('e1', 'me');
    expect(result).toEqual([]);
  });

  it('returns empty on myProfile query error', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
      })
      .mockReturnValueOnce(makeChain([]));

    const result = await getGridParticipants('e1', 'me');
    expect(result).toEqual([]);
  });

  it('filters out blocked participants', async () => {
    vi.mocked(getBlockedIds).mockResolvedValue(new Set(['p2']));

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { gender: 'male', attracted_to: 'women' },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: 'p2', display_name: 'Blocked', gender: 'female', attracted_to: 'men', age: 25, participant_photos: [] },
            { id: 'p3', display_name: 'Visible', gender: 'female', attracted_to: 'men', age: 25, participant_photos: [] },
          ],
          error: null,
        }),
      });

    const result = await getGridParticipants('e1', 'me');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p3');
  });

  it('filters by cross-attraction (male→women only sees women→men)', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { gender: 'male', attracted_to: 'women' },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: 'p1', display_name: 'F1', gender: 'female', attracted_to: 'men', age: 22, participant_photos: [] },
            { id: 'p2', display_name: 'F2', gender: 'female', attracted_to: 'women', age: 22, participant_photos: [] },
            { id: 'p3', display_name: 'M1', gender: 'male', attracted_to: 'men', age: 22, participant_photos: [] },
          ],
          error: null,
        }),
      });

    const result = await getGridParticipants('e1', 'me');
    // F1 is female attracted_to men → cross-match ✓
    // F2 is female attracted_to women → I'm attracted to her but she's not attracted to me ✗
    // M1 is male → I'm not attracted to men ✗
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('attracted_to "all" matches anyone', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { gender: 'female', attracted_to: 'all' },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: 'p1', display_name: 'M', gender: 'male', attracted_to: 'all', age: 25, participant_photos: [] },
            { id: 'p2', display_name: 'F', gender: 'female', attracted_to: 'all', age: 25, participant_photos: [] },
          ],
          error: null,
        }),
      });

    const result = await getGridParticipants('e1', 'me');
    expect(result).toHaveLength(2);
  });

  it('filters out participants with empty name or no age', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { gender: 'male', attracted_to: 'all' },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: 'p1', display_name: '', gender: 'male', attracted_to: 'all', age: 25, participant_photos: [] },
            { id: 'p2', display_name: 'Good', gender: 'female', attracted_to: 'all', age: null, participant_photos: [] },
            { id: 'p3', display_name: 'OK', gender: 'female', attracted_to: 'all', age: 30, participant_photos: [] },
          ],
          error: null,
        }),
      });

    const result = await getGridParticipants('e1', 'me');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p3');
  });

  it('maps participant_photos to photos field', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { gender: 'female', attracted_to: 'all' },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{
            id: 'p1',
            display_name: 'Test',
            gender: 'male',
            attracted_to: 'all',
            age: 25,
            participant_photos: [{ id: 'ph1', storage_path: 'a.jpg' }],
          }],
          error: null,
        }),
      });

    const result = await getGridParticipants('e1', 'me');
    expect(result[0].photos).toEqual([{ id: 'ph1', storage_path: 'a.jpg' }]);
    expect((result[0] as any).participant_photos).toBeUndefined();
  });
});
