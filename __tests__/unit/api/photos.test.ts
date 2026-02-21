/**
 * Unit tests for lib/api/photos.ts — uploadPhoto, deletePhoto, reorderPhotos, getMyPhotos
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
  vi.clearAllMocks();
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
});

// ---------- uploadPhoto ----------
describe('uploadPhoto', () => {
  function mockSuccessPath() {
    // Step 1: sign url
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signedUrl: 'https://storage/signed', token: 'tok' }),
      } as Response)
      // Step 2: PUT upload
      .mockResolvedValueOnce({ ok: true } as Response)
      // Step 3: DB record
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'photo1', storage_path: 'e/p/1.webp', order_index: 0 }),
      } as Response);
  }

  it('returns photo data on full success', async () => {
    mockSuccessPath();
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    const result = await uploadPhoto('event1', 'part1', file, 0);
    expect(result).toEqual(expect.objectContaining({ id: 'photo1' }));
  });

  it('returns null when signed URL request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'err',
    } as Response);
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });

  it('falls back to SDK upload when PUT fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signedUrl: 'https://x/s', token: 'tok' }),
      } as Response)
      // PUT fails
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      // DB record
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'p2' }),
      } as Response);

    mockUploadToSignedUrl.mockResolvedValueOnce({ error: null });
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    const result = await uploadPhoto('e', 'p', file, 0);
    expect(mockUploadToSignedUrl).toHaveBeenCalled();
    expect(result).toEqual({ id: 'p2' });
  });

  it('returns null when both upload methods fail', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signedUrl: 'https://x/s', token: 'tok' }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    mockUploadToSignedUrl.mockResolvedValueOnce({ error: { message: 'fail' } });
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });

  it('returns null when DB record creation fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signedUrl: 'https://x/s', token: 'tok' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'db error',
      } as Response);

    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadPhoto('e', 'p', file, 0)).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
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
