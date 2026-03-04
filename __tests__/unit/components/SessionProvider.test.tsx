import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SESSION_STORAGE_KEY } from '@/lib/constants';

// ── Mocks ──
let mockSession: Record<string, string> | null = null;
const mockSetSession = vi.fn();
const mockClearSession = vi.fn();
const mockSetPhotos = vi.fn();

vi.mock('@/lib/store', () => ({
  useSessionStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        session: mockSession,
        photos: [],
      }),
    {
      getState: () => ({
        session: mockSession,
        photos: [],
        setSession: mockSetSession,
        clearSession: mockClearSession,
        setPhotos: mockSetPhotos,
      }),
    },
  ),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { name: 'Test Event', background_image: null }, error: null }),
        }),
      }),
    }),
  },
  setEventContext: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getMyPhotos: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/hooks/useAppResume', () => ({
  useAppResume: vi.fn(),
}));

vi.mock('@/hooks/useRealtimeHub', () => ({
  useRealtimeHub: vi.fn(),
}));

// ── Mock fetch ──
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import SessionProvider from '@/components/SessionProvider';

describe('SessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('U-CMP-27: hydrates from cookie via /api/auth/verify', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        eventId: 'e1',
        eventSlug: 'test-event',
        eventName: 'Test Event',
        participantId: 'p1',
      }),
    });

    render(
      <SessionProvider eventSlug="test-event">
        <div>children</div>
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ participantId: 'p1', eventSlug: 'test-event' }),
      );
    });
  });

  it('U-CMP-28: banned user (403) → clears session and redirects', async () => {
    // Mock window.location
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      value: { href: originalHref },
      writable: true,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    render(
      <SessionProvider eventSlug="test-event">
        <div>children</div>
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
    });
  });

  it('falls back to localStorage when verify fails', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      eventId: 'e1',
      eventSlug: 'test-event',
      participantId: 'p1',
    }));

    mockFetch.mockRejectedValueOnce(new Error('network error'));

    render(
      <SessionProvider eventSlug="test-event">
        <div>children</div>
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ participantId: 'p1' }),
      );
    });
  });

  it('renders children when session already in store', () => {
    mockSession = {
      eventId: 'e1',
      eventSlug: 'test-event',
      participantId: 'p1',
    };

    const { getByText } = render(
      <SessionProvider eventSlug="test-event">
        <div>child content</div>
      </SessionProvider>,
    );

    expect(getByText('child content')).toBeInTheDocument();
  });
});
