/**
 * Unit tests for lib/api/matches.ts - getMatches
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/api/helpers', () => ({
  getBlockedIds: vi.fn().mockResolvedValue(new Set()),
  buildParticipantPhotoMaps: vi.fn().mockResolvedValue({
    pMap: new Map(),
    phMap: new Map(),
  }),
}));

import { getMatches } from '@/lib/api/matches';
import { getBlockedIds, buildParticipantPhotoMaps } from '@/lib/api/helpers';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations
  vi.mocked(getBlockedIds).mockResolvedValue(new Set());
  vi.mocked(buildParticipantPhotoMaps).mockResolvedValue({
    pMap: new Map(),
    phMap: new Map(),
  });
});

describe('getMatches', () => {
  it('returns empty array when no likes exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    });
    // First query: my likes
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const result = await getMatches('e1', 'me');
    expect(result).toEqual([]);
  });

  it('returns empty array when no reciprocal likes', async () => {
    // My likes query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ to_participant_id: 'p2', created_at: '2025-01-01' }],
            error: null,
          }),
        }),
      }),
    });
    // Reciprocal query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const result = await getMatches('e1', 'me');
    expect(result).toEqual([]);
  });

  it('returns matches sorted newest first', async () => {
    // My likes
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { to_participant_id: 'p2', created_at: '2025-01-01T10:00:00Z' },
              { to_participant_id: 'p3', created_at: '2025-01-02T10:00:00Z' },
            ],
            error: null,
          }),
        }),
      }),
    });
    // Reciprocal
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { from_participant_id: 'p2', created_at: '2025-01-01T11:00:00Z' },
                { from_participant_id: 'p3', created_at: '2025-01-02T09:00:00Z' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    vi.mocked(buildParticipantPhotoMaps).mockResolvedValue({
      pMap: new Map([
        ['p2', { id: 'p2', name: 'P2' } as any],
        ['p3', { id: 'p3', name: 'P3' } as any],
      ]),
      phMap: new Map([
        ['p2', [{ id: 'ph1' } as any]],
        ['p3', []],
      ]),
    });

    const result = await getMatches('e1', 'me');
    expect(result).toHaveLength(2);
    // p3 match is later (2025-01-02T10:00:00Z) than p2 (2025-01-01T11:00:00Z)
    expect(result[0].participantId).toBe('p3');
    expect(result[1].participantId).toBe('p2');
  });

  it('excludes blocked participants', async () => {
    vi.mocked(getBlockedIds).mockResolvedValue(new Set(['p2']));

    // My likes
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ to_participant_id: 'p2', created_at: '2025-01-01' }],
            error: null,
          }),
        }),
      }),
    });
    // Reciprocal
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ from_participant_id: 'p2', created_at: '2025-01-02' }],
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await getMatches('e1', 'me');
    expect(result).toEqual([]);
  });

  it('handles query errors gracefully', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'query failed' },
          }),
        }),
      }),
    });

    const result = await getMatches('e1', 'me');
    expect(result).toEqual([]);
  });
});
