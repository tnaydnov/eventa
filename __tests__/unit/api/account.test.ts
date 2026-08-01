/**
 * Unit tests for lib/api/account.ts - deleteAccount
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAccount } from '@/lib/api/account';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('deleteAccount', () => {
  it('returns ok:true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response);

    const result = await deleteAccount();
    expect(result).toEqual({ ok: true });
  });

  it('returns ok:false with status on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as Response);

    const result = await deleteAccount();
    expect(result).toEqual({ ok: false, error: '500' });
  });

  it('returns ok:false with network on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));

    const result = await deleteAccount();
    expect(result).toEqual({ ok: false, error: 'network' });
  });

  it('sends POST with empty JSON body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response);

    await deleteAccount();
    expect(spy).toHaveBeenCalledWith('/api/account/delete', expect.objectContaining({
      method: 'POST',
      body: '{}',
    }));
  });
});
