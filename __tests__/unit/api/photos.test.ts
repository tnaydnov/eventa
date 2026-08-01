/**
 * Unit tests for lib/api/photos.ts - uploadPhoto, deletePhoto, reorderPhotos, getMyPhotos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());
const mockUploadToSignedUrl = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: () => ({ uploadToSignedUrl: mockUploadToSignedUrl }),
    },
  },
}));

vi.mock('@/lib/image-compression', () => ({
  compressProfilePhoto: vi.fn(async (f: File) => f),
}));

vi.mock('@/lib/validations', () => ({
  validateImageMagicBytes: vi.fn(),
  getEffectiveImageType: vi.fn(() => 'image/webp'),
}));

vi.mock('@/lib/api/helpers', () => ({
  PHOTO_COLUMNS: 'id, storage_path, order_index',
}));

import { uploadPhoto, deletePhoto, reorderPhotos, getMyPhotos } from '@/lib/api/photos';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mockUploadToSignedUrl.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
});

// ---------- uploadPhoto ----------
describe('uploadPhoto', () => {
  // Route fetch by URL so the test is deterministic regardless of how many calls happen.
  // fetchWithRetry emits API telemetry via an extra fetch('/api/telemetry/...') on a
  // ~10% random sample of successful /api/secure/* calls (when sendBeacon is unavailable,
  // as in jsdom). Order-based mockResolvedValueOnce queues are therefore racy - a stolen
  // queue entry made the DB-record call hit the real relative URL and throw. Routing by
  // URL removes that coupling.
  function routeFetch(routes: Array<{ match: string; res: Partial<Response> }>) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      for (const r of routes) {
        if (url.includes(r.match)) return r.res as Response;
      }
      // Telemetry + anything else: succeed quietly so it never affects the assertion.
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' } as Response;
    });
  }

  const okJson = (data: unknown): Partial<Response> => ({ ok: true, status: 200, json: async () => data });

  it('returns photo data on full success', async () => {
    routeFetch([
      { match: 'upload-url', res: okJson({ signedUrl: 'https://storage/signed', token: 'tok' }) },
      { match: '/api/secure/photos', res: okJson({ id: 'photo1', storage_path: 'e/p/1.webp', order_index: 0 }) },
    ]);
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    const result = await uploadPhoto('event1', 'part1', file, 0);
    expect(result).toEqual(expect.objectContaining({ id: 'photo1' }));
  });

  it('returns null when signed URL request fails', async () => {
    routeFetch([
      { match: 'upload-url', res: { ok: false, status: 500, text: async () => 'err' } as Partial<Response> },
    ]);
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });

  it('uploads via SDK path successfully', async () => {
    routeFetch([
      { match: 'upload-url', res: okJson({ signedUrl: 'https://x/s', token: 'tok' }) },
      { match: '/api/secure/photos', res: okJson({ id: 'p2' }) },
    ]);
    mockUploadToSignedUrl.mockResolvedValueOnce({ error: null });
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    const result = await uploadPhoto('e', 'p', file, 0);
    expect(mockUploadToSignedUrl).toHaveBeenCalled();
    expect(result).toEqual({ id: 'p2' });
  });

  it('returns null when SDK upload fails', async () => {
    routeFetch([
      { match: 'upload-url', res: okJson({ signedUrl: 'https://x/s', token: 'tok' }) },
    ]);
    mockUploadToSignedUrl.mockResolvedValueOnce({ error: { message: 'fail' } });
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });

  it('returns null when DB record creation fails', async () => {
    routeFetch([
      { match: 'upload-url', res: okJson({ signedUrl: 'https://x/s', token: 'tok' }) },
      { match: '/api/secure/photos', res: { ok: false, status: 500, text: async () => 'db error' } as Partial<Response> },
    ]);
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });
});

// ---------- deletePhoto ----------
describe('deletePhoto', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    expect(await deletePhoto('photo1', 'e/p/1.webp')).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await deletePhoto('photo1', 'e/p/1.webp')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await deletePhoto('photo1', 'e/p/1.webp')).toBe(false);
  });

  it('sends correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    await deletePhoto('pid', 'path/x');
    expect(spy).toHaveBeenCalledWith('/api/secure/photos', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ photoId: 'pid', storagePath: 'path/x' }),
    }));
  });
});

// ---------- reorderPhotos ----------
describe('reorderPhotos', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    const order = [{ id: '1', order_index: 0 }, { id: '2', order_index: 1 }];
    expect(await reorderPhotos(order)).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await reorderPhotos([])).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await reorderPhotos([])).toBe(false);
  });

  it('sends PATCH with order array', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    const order = [{ id: 'a', order_index: 0 }];
    await reorderPhotos(order);
    expect(spy).toHaveBeenCalledWith('/api/secure/photos', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ order }),
    }));
  });
});

// ---------- getMyPhotos ----------
describe('getMyPhotos', () => {
  it('returns photos array on success', async () => {
    const photos = [{ id: '1', storage_path: 'a', order_index: 0 }];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: photos, error: null }),
    });

    const result = await getMyPhotos('p1');
    expect(result).toEqual(photos);
  });

  it('returns empty array on error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });

    const result = await getMyPhotos('p1');
    expect(result).toEqual([]);
  });
});
