/**
 * Unit tests for lib/api/blocks.ts — blockParticipant
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/helpers', () => ({
  invalidateBlockedCache: vi.fn(),
}));

import { blockParticipant } from '@/lib/api/blocks';
import { invalidateBlockedCache } from '@/lib/api/helpers';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(invalidateBlockedCache).mockClear();
});

describe('blockParticipant', () => {
  it('returns true on success and invalidates cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);

    const result = await blockParticipant('blocked-id');
    expect(result).toBe(true);
    expect(invalidateBlockedCache).toHaveBeenCalled();
  });

  it('returns false on failure and does not invalidate cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);

    const result = await blockParticipant('blocked-id');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));

    const result = await blockParticipant('blocked-id');
    expect(result).toBe(false);
  });

  it('sends correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);

    await blockParticipant('target-id');
    expect(spy).toHaveBeenCalledWith('/api/secure/blocks', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ blockedId: 'target-id' }),
    }));
  });
});
