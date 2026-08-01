import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '@/lib/api/fetch-retry';

describe('fetchWithRetry telemetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('ws_session', JSON.stringify({ eventId: '11111111-1111-4111-8111-111111111111' }));
    (navigator as Navigator & { sendBeacon: (url: string, data?: BodyInit | null) => boolean }).sendBeacon = vi.fn(() => true);
  });

  it('emits sampled api_request telemetry for successful API calls', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // sampled
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const res = await fetchWithRetry('/api/secure/profile', { method: 'GET' });

    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect(navigator.sendBeacon).toHaveBeenCalledWith('/api/telemetry/reliability', expect.any(Blob));
  });

  it('emits api_error telemetry for 4xx responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 400 }));

    const res = await fetchWithRetry('/api/secure/profile', { method: 'PATCH', body: '{}' });

    expect(res.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('does not emit telemetry for telemetry endpoint calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await fetchWithRetry('/api/telemetry/reliability', { method: 'POST', body: '{}' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it('emits api_error telemetry when network fails on final attempt', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(fetchWithRetry('/api/secure/profile', { method: 'GET' }, { retries: 0 })).rejects.toThrow('offline');
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });
});
