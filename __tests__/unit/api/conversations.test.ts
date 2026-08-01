/**
 * Unit tests for lib/api/conversations.ts
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
  compressChatImage: vi.fn(async (f: File) => f),
}));

vi.mock('@/lib/validations', () => ({
  validateImageMagicBytes: vi.fn(),
  getEffectiveImageType: vi.fn(() => 'image/webp'),
}));

vi.mock('@/lib/api/helpers', () => ({
  getBlockedIds: vi.fn().mockResolvedValue(new Set()),
  buildParticipantPhotoMaps: vi.fn().mockResolvedValue({ pMap: new Map(), phMap: new Map() }),
  CONVERSATION_COLUMNS: 'id, event_id',
  MESSAGE_COLUMNS: 'id, text, type',
}));

import {
  getOrCreateConversation,
  getMessages,
  getMessagesBefore,
  sendMessage,
  deleteMessage,
  uploadChatImage,
  markConversationRead,
} from '@/lib/api/conversations';

beforeEach(() => {
  vi.clearAllMocks();
  // Default supabase mock - query chain
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
});

// ---------- getOrCreateConversation ----------
describe('getOrCreateConversation', () => {
  it('returns conversation on success', async () => {
    const convo = { id: 'c1', event_id: 'e1' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => convo,
    } as Response);

    expect(await getOrCreateConversation('other-id')).toEqual(convo);
  });

  it('returns null on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await getOrCreateConversation('other-id')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await getOrCreateConversation('other-id')).toBeNull();
  });

  it('sends correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await getOrCreateConversation('p2');
    expect(spy).toHaveBeenCalledWith('/api/secure/conversations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ otherId: 'p2' }),
    }));
  });
});

// ---------- getMessages ----------
describe('getMessages', () => {
  it('returns messages reversed (oldest first)', async () => {
    const msgs = [{ id: 'm2', created_at: '2025-01-02' }, { id: 'm1', created_at: '2025-01-01' }];
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: msgs, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await getMessages('c1');
    // .reverse() mutates in-place, so compare with literal expected order
    expect(result).toEqual([{ id: 'm1', created_at: '2025-01-01' }, { id: 'm2', created_at: '2025-01-02' }]);
  });

  it('returns empty array on error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    };
    mockFrom.mockReturnValue(chain);

    expect(await getMessages('c1')).toEqual([]);
  });
});

// ---------- getMessagesBefore ----------
describe('getMessagesBefore', () => {
  it('returns reversed messages for pagination', async () => {
    const msgs = [{ id: 'm3' }, { id: 'm2' }];
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: msgs, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await getMessagesBefore('c1', '2025-01-05');
    // .reverse() mutates in-place, so compare with literal expected order
    expect(result).toEqual([{ id: 'm2' }, { id: 'm3' }]);
  });

  it('returns empty array on error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    };
    mockFrom.mockReturnValue(chain);

    expect(await getMessagesBefore('c1', 'ts')).toEqual([]);
  });
});

// ---------- sendMessage ----------
describe('sendMessage', () => {
  it('returns message on success', async () => {
    const msg = { id: 'm1', text: 'hello' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => msg,
    } as Response);

    expect(await sendMessage('c1', 'hello')).toEqual(msg);
  });

  it('returns null on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await sendMessage('c1', 'hi')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await sendMessage('c1', 'hi')).toBeNull();
  });

  it('sends correct body with type and mediaPath', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await sendMessage('c1', '', 'image', 'path/img.webp');
    expect(spy).toHaveBeenCalledWith('/api/secure/messages', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'c1',
        text: '',
        type: 'image',
        mediaPath: 'path/img.webp',
      }),
    }));
  });
});

// ---------- deleteMessage ----------
describe('deleteMessage', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    expect(await deleteMessage('m1')).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await deleteMessage('m1')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await deleteMessage('m1')).toBe(false);
  });

  it('sends PATCH with messageId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    await deleteMessage('m99');
    expect(spy).toHaveBeenCalledWith('/api/secure/messages', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ messageId: 'm99' }),
    }));
  });
});

// ---------- uploadChatImage ----------
describe('uploadChatImage', () => {
  it('returns path on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tok' }),
    } as Response);
    mockUploadToSignedUrl.mockResolvedValueOnce({ error: null });

    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    const result = await uploadChatImage('e1', 'c1', file);
    expect(result).toMatch(/^chat\/e1\/c1\/\d+\.webp$/);
  });

  it('returns null when signedUrl request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadChatImage('e1', 'c1', file)).toBeNull();
  });

  it('returns null when storage upload fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tok' }),
    } as Response);
    mockUploadToSignedUrl.mockResolvedValueOnce({ error: { message: 'fail' } });

    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadChatImage('e1', 'c1', file)).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const file = new File(['data'], 'pic.webp', { type: 'image/webp' });
    expect(await uploadChatImage('e1', 'c1', file)).toBeNull();
  });
});

// ---------- markConversationRead ----------
describe('markConversationRead', () => {
  it('returns true on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    expect(await markConversationRead('c1')).toBe(true);
  });

  it('returns false on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
    expect(await markConversationRead('c1')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await markConversationRead('c1')).toBe(false);
  });

  it('sends correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    await markConversationRead('c99');
    expect(spy).toHaveBeenCalledWith('/api/secure/conversations/read', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ conversationId: 'c99' }),
    }));
  });
});
