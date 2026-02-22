/**
 * Unit tests for lib/api/helpers.ts - getPhotoUrl, getBlockedIds, invalidateBlockedCache, buildParticipantPhotoMaps
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(),
    })),
  },
}));

import { getPhotoUrl, invalidateBlockedCache, getBlockedIds, buildParticipantPhotoMaps } from '@/lib/api/helpers';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

describe('getPhotoUrl', () => {
  it('builds correct URL from storage path', () => {
    const url = getPhotoUrl('event-1/user-1/photo.jpg');
    expect(url).toContain('/storage/v1/object/public/photos/');
    expect(url).toContain('event-1/user-1/photo.jpg');
  });

  it('handles empty storage path', () => {
    const url = getPhotoUrl('');
    expect(url).toContain('/storage/v1/object/public/photos/');
  });

  it('handles paths with special characters', () => {
    const url = getPhotoUrl('event-1/user-1/photo with spaces.jpg');
    expect(url).toContain('photo with spaces.jpg');
  });
});

describe('invalidateBlockedCache', () => {
  it('does not throw', () => {
    expect(() => invalidateBlockedCache()).not.toThrow();
  });

  it('can be called multiple times', () => {
    invalidateBlockedCache();
    invalidateBlockedCache();
    // No throw = pass
  });
});

describe('column constants', () => {
  it('exports expected column strings', async () => {
    const { PARTICIPANT_COLUMNS, PHOTO_COLUMNS, CONVERSATION_COLUMNS, MESSAGE_COLUMNS, LIKE_COLUMNS } = await import('@/lib/api/helpers');
    expect(PARTICIPANT_COLUMNS).toContain('id');
    expect(PARTICIPANT_COLUMNS).toContain('display_name');
    expect(PHOTO_COLUMNS).toContain('storage_path');
    expect(CONVERSATION_COLUMNS).toContain('last_message_at');
    expect(MESSAGE_COLUMNS).toContain('text');
    expect(LIKE_COLUMNS).toContain('from_participant_id');
  });
});

describe('getBlockedIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateBlockedCache();
  });

  it('U-API-HLP-03: fetches blocked IDs from Supabase, returns Set<string>', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({
        data: [
          { blocker_id: 'me', blocked_id: 'u1' },
          { blocker_id: 'u2', blocked_id: 'me' },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain);

    const ids = await getBlockedIds('event-1', 'me');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.has('u1')).toBe(true);
    expect(ids.has('u2')).toBe(true);
    expect(ids.has('me')).toBe(false); // excludes own ID
  });

  it('U-API-HLP-04: cached, second call does not re-fetch', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({
        data: [{ blocker_id: 'me', blocked_id: 'u1' }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockChain);

    await getBlockedIds('event-1', 'me');
    await getBlockedIds('event-1', 'me');
    // Should only call .from() once because of caching
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('throws on DB error', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      }),
    };
    mockFrom.mockReturnValue(mockChain);

    await expect(getBlockedIds('event-1', 'me')).rejects.toThrow('Failed to fetch blocked IDs');
  });
});

describe('buildParticipantPhotoMaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-API-HLP-07: empty ID list returns empty maps', async () => {
    const { pMap, phMap } = await buildParticipantPhotoMaps([]);
    expect(pMap.size).toBe(0);
    expect(phMap.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('U-API-HLP-06: batches photo lookup, returns maps with all IDs', async () => {
    const mockParticipant = { id: 'p1', display_name: 'User1', gender: 'male' };
    const mockPhoto = { id: 'ph1', participant_id: 'p1', storage_path: 'x.jpg', order_index: 0 };

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [mockPhoto], error: null }),
    };
    // For participants query (no .order)
    const mockParticipantChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [mockParticipant], error: null }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      // Alternate: first call is participants, second is photos
      if (callCount % 2 === 1) return mockParticipantChain;
      return mockChain;
    });

    const { pMap, phMap } = await buildParticipantPhotoMaps(['p1']);
    expect(pMap.get('p1')).toBeDefined();
    expect(phMap.get('p1')).toHaveLength(1);
  });
});
