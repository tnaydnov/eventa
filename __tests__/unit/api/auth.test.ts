/**
 * Unit tests for lib/api/auth.ts - joinEvent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { joinEvent } from '@/lib/api/auth';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('joinEvent', () => {
  it('returns session data on success', async () => {
    const mockData = {
      eventId: 'e1',
      eventName: 'Test',
      backgroundImage: null,
      participantId: 'p1',
      participant: null,
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await joinEvent('my-event', 'join-code-12chars');
    expect(result).toEqual(mockData);
  });

  it('returns null on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await joinEvent('bad-slug', 'invalid-code1');
    expect(result).toBeNull();
  });

  it('throws DEVICE_BANNED on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(joinEvent('slug', 'code-12345678')).rejects.toThrow('DEVICE_BANNED');
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const result = await joinEvent('slug', 'code-12345678');
    expect(result).toBeNull();
  });

  it('sends correct body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({} as any),
    } as Response);

    await joinEvent('my-slug', 'my-code-123456', 'local-id', 'hw-fp');
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/join', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        eventSlug: 'my-slug',
        joinCode: 'my-code-123456',
        fingerprint: 'local-id',
        hardwareFingerprint: 'hw-fp',
      }),
    }));
  });
});
