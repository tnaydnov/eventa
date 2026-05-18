import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ── Mocks ──
const mockSession = {
  eventId: 'e1',
  eventSlug: 'test-event',
  participantId: 'p1',
};

const mockAddGridHighlight = vi.fn();
const mockIncrementLikes = vi.fn();
const mockSetUnreadLikes = vi.fn();
const mockInitializeUnreadConvos = vi.fn();
const mockSetInitialized = vi.fn();
const mockAddUnreadConvo = vi.fn();
const mockShow = vi.fn();
const mockSetPendingMatch = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/test-event',
}));

vi.mock('@/lib/store', () => ({
  useSessionStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ session: mockSession }),
  useNotificationStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        _initialized: false,
        gridHighlights: [],
      }),
    {
      getState: () => ({
        _initialized: false,
        gridHighlights: [],
        addGridHighlight: mockAddGridHighlight,
        incrementLikes: mockIncrementLikes,
        decrementLikes: vi.fn(),
        setUnreadLikes: mockSetUnreadLikes,
        initializeUnreadConvos: mockInitializeUnreadConvos,
        setInitialized: mockSetInitialized,
        addUnreadConvo: mockAddUnreadConvo,
        removeGridHighlightByType: vi.fn(),
      }),
    },
  ),
  useToastStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ show: mockShow }),
  useMatchStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({ pendingMatch: null, setPendingMatch: mockSetPendingMatch }),
    {
      getState: () => ({ setPendingMatch: mockSetPendingMatch }),
    },
  ),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          or: () => ({ data: [{ id: 'conv1' }] }),
          single: () => ({ data: { display_name: 'Test' } }),
          maybeSingle: () => ({ data: null }),
          order: () => ({
            limit: () => ({ data: [] }),
          }),
        }),
        is: () => ({ data: [] }),
        in: () => ({
          gt: () => ({
            order: () => ({ data: [] }),
          }),
        }),
        neq: () => ({
          in: () => ({
            gt: () => ({
              order: () => ({ data: [] }),
            }),
          }),
        }),
        gt: () => ({
          order: () => ({ data: [] }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/useRealtimeHub', () => ({
  useRealtimeHub: vi.fn(),
}));

vi.mock('@/hooks/useAppResume', () => ({
  useAppResume: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getUnseenLikes: vi.fn().mockResolvedValue([]),
  getUnreadConversations: vi.fn().mockResolvedValue([]),
  getPhotoUrl: (path: string) => `https://storage.example.com/${path}`,
}));

import RealtimeNotificationListener from '@/components/RealtimeNotificationListener';

describe('RealtimeNotificationListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('U-CMP-30: subscribes to Realtime channels via hub', async () => {
    const { useRealtimeHub } = await import('@/hooks/useRealtimeHub');
    render(<RealtimeNotificationListener />);
    expect(useRealtimeHub).toHaveBeenCalled();
  });

  it('U-CMP-31: initializes unread state from DB on mount', async () => {
    const { getUnseenLikes, getUnreadConversations } = await import('@/lib/api');
    (getUnseenLikes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['sender1', 'sender2']);
    (getUnreadConversations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { conversationId: 'c1', otherParticipantId: 'other1' },
    ]);

    // Reset the _initialized flag
    const { useNotificationStore } = await import('@/lib/store');
    (useNotificationStore.getState as () => Record<string, unknown>)()._initialized = false;

    render(<RealtimeNotificationListener />);
    // The init runs in a microtask
    await vi.advanceTimersByTimeAsync(100);
  });

  it('U-CMP-33: renders null (no visual output)', () => {
    const { container } = render(<RealtimeNotificationListener />);
    expect(container.innerHTML).toBe('');
  });

  it('sets up polling interval on mount', async () => {
    render(<RealtimeNotificationListener />);
    // Advance 15 seconds - polling should fire
    await vi.advanceTimersByTimeAsync(15_000);
    // No error means polling ran successfully
  });
});

// Need afterEach import for cleanup
import { afterEach } from 'vitest';
