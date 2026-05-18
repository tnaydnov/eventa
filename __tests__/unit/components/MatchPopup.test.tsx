import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ──
const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/test-event');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

const mockSession = {
  eventId: 'e1',
  eventSlug: 'test-event',
  participantId: 'p1',
};

const mockPendingMatch = {
  id: 'p2',
  displayName: 'דנה',
  photoUrl: 'https://example.com/photo.jpg',
};

const mockClearPendingMatch = vi.fn();
const mockSetPendingMatch = vi.fn();

vi.mock('@/lib/store', () => ({
  useMatchStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      pendingMatch: mockPendingMatch,
      clearPendingMatch: mockClearPendingMatch,
      setPendingMatch: mockSetPendingMatch,
    }),
  useSessionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      session: mockSession,
      photos: [{ storage_path: 'photos/p1/photo1.jpg' }],
    }),
}));

vi.mock('@/lib/api', () => ({
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 'conv-1' }),
  getPhotoUrl: (path: string) => `https://storage.example.com/${path}`,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, ...props }: Record<string, unknown>) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return <div onClick={onClick as React.MouseEventHandler} {...rest}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import MatchPopup from '@/components/MatchPopup';

describe('MatchPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-CMP-13: shows matched participant name + photo', () => {
    render(<MatchPopup />);
    expect(screen.getByText(/דנה/)).toBeInTheDocument();
    const imgs = screen.getAllByRole('img');
    const matchImg = imgs.find(img => img.getAttribute('alt') === 'דנה');
    expect(matchImg).toBeTruthy();
  });

  it('U-CMP-14: "שלח/י הודעה" button creates conversation and navigates to chat', async () => {
    render(<MatchPopup />);
    const sendBtn = screen.getByText('שלח/י הודעה');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockClearPendingMatch).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/test-event/chat/conv-1');
    });
  });

  it('U-CMP-15: dismiss clears pending match', () => {
    render(<MatchPopup />);
    const dismissBtn = screen.getByText('המשך לגלול');
    fireEvent.click(dismissBtn);
    expect(mockClearPendingMatch).toHaveBeenCalled();
  });
});
