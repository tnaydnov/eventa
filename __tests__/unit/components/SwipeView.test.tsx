import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ──
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, exit, transition, drag, dragSnapToOrigin, dragConstraints, onDrag, onDragEnd, onDragStart, whileTap, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
  },
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useTransform: () => ({ get: () => 0 }),
}));

const mockSession = { eventId: 'e1', eventSlug: 'test', participantId: 'me' };
let mockDismissedIds = new Set<string>();
let mockLikedIds = new Set<string>();
let mockLikedIdsLoaded = true;
const mockDismiss = vi.fn((id: string) => { mockDismissedIds.add(id); });
const mockAddLiked = vi.fn();
const mockRemoveLiked = vi.fn();
const mockStartPendingLike = vi.fn();
const mockFinishPendingLike = vi.fn();
const mockSetLikedIds = vi.fn();
const mockResetPool = vi.fn();
const mockShowToast = vi.fn();
const mockSetPendingMatch = vi.fn();

vi.mock('@/lib/store', () => ({
  useSessionStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ session: mockSession }),
  useSwipeStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        dismissedIds: mockDismissedIds,
        likedIds: mockLikedIds,
        likedIdsLoaded: mockLikedIdsLoaded,
        dismiss: mockDismiss,
        addLiked: mockAddLiked,
        removeLiked: mockRemoveLiked,
        startPendingLike: mockStartPendingLike,
        finishPendingLike: mockFinishPendingLike,
        setLikedIds: mockSetLikedIds,
        resetPool: mockResetPool,
      }),
    {
      // SwipeView guards double-likes via useSwipeStore.getState().isPendingLike(id).
      getState: () => ({
        isPendingLike: () => false,
        startPendingLike: mockStartPendingLike,
        finishPendingLike: mockFinishPendingLike,
      }),
    },
  ),
  useToastStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ show: mockShowToast }),
  useMatchStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({ setPendingMatch: mockSetPendingMatch }),
    { getState: () => ({ setPendingMatch: mockSetPendingMatch }) },
  ),
  GridParticipant: {},
}));

vi.mock('@/lib/api', () => ({
  sendLike: vi.fn().mockResolvedValue({ match: false }),
  getSentLikeIds: vi.fn().mockResolvedValue([]),
  getPhotoUrl: (p: string) => `https://cdn/${p}`,
}));

vi.mock('@/components/Icons', () => ({
  HeartFilledIcon: ({ size, color }: { size: number; color: string }) => <svg data-testid="heart-icon" />,
  SearchIcon: ({ size }: { size: number }) => <svg data-testid="search-icon" />,
  UserIcon: () => <svg data-testid="user-icon" />,
}));

vi.mock('@/lib/constants', () => ({
  LOOKING_FOR_LABELS: { serious: 'קשר רציני' },
}));

// Mock SwipeCard to simplify
vi.mock('@/app/[eventSlug]/_components/SwipeCard', () => ({
  __esModule: true,
  default: ({ participant, onSwipeRight, onSwipeLeft, onViewProfile }: Record<string, unknown>) => (
    <div data-testid={`card-${(participant as { id: string }).id}`}>
      <span>{(participant as { display_name: string }).display_name}</span>
      <button onClick={onSwipeRight as () => void}>like</button>
      <button onClick={onSwipeLeft as () => void}>dismiss</button>
      <button onClick={onViewProfile as () => void}>view</button>
    </div>
  ),
}));

import SwipeView from '@/app/[eventSlug]/_components/SwipeView';

const makeParticipants = () => [
  { id: 'p1', display_name: 'Alice', age: 25, bio: '', city: '', looking_for: 'serious', photos: [{ id: 'ph1', storage_path: 'photos/p1/1.jpg', order_index: 0 }] },
  { id: 'p2', display_name: 'Bob', age: 27, bio: '', city: '', looking_for: 'serious', photos: [] },
  { id: 'p3', display_name: 'Charlie', age: 30, bio: '', city: '', looking_for: 'serious', photos: [] },
];

describe('SwipeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDismissedIds = new Set();
    mockLikedIds = new Set();
    mockLikedIdsLoaded = true;
  });

  it('U-DAT-07: shows cards from participants minus dismissed/liked', () => {
    mockLikedIds = new Set(['p1']);
    render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    expect(screen.queryByTestId('card-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-p2')).toBeInTheDocument();
  });

  it('U-DAT-08: empty pool shows reset prompt', () => {
    mockDismissedIds = new Set(['p1', 'p2', 'p3']);
    render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    expect(screen.getByText(/עברת על כולם/)).toBeInTheDocument();
    expect(screen.getByText(/אפס רשימה/)).toBeInTheDocument();
  });

  it('reset button calls resetPool and shows toast', () => {
    mockDismissedIds = new Set(['p1', 'p2', 'p3']);
    render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    fireEvent.click(screen.getByText(/אפס רשימה/));
    expect(mockResetPool).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalled();
  });

  it('shows loading spinner while liked IDs not loaded', () => {
    mockLikedIdsLoaded = false;
    const { container } = render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    expect(container.querySelector('.loading-spinner')).toBeTruthy();
  });

  it('renders at most 3 cards for performance', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      display_name: `User${i}`,
      age: 25,
      bio: '',
      city: '',
      looking_for: 'serious',
      photos: [],
    }));
    render(<SwipeView participants={many} eventSlug="test" />);
    const cards = screen.getAllByTestId(/^card-/);
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('like button on card triggers addLiked + sendLike', async () => {
    render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    const likeBtn = screen.getAllByText('like')[0];
    fireEvent.click(likeBtn);
    expect(mockAddLiked).toHaveBeenCalledWith('p1');
  });

  it('dismiss button on card triggers dismiss', () => {
    render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    const dismissBtn = screen.getAllByText('dismiss')[0];
    fireEvent.click(dismissBtn);
    expect(mockDismiss).toHaveBeenCalledWith('p1');
  });

  it('view button navigates to user profile', () => {
    render(<SwipeView participants={makeParticipants()} eventSlug="test" />);
    const viewBtn = screen.getAllByText('view')[0];
    fireEvent.click(viewBtn);
    expect(mockPush).toHaveBeenCalledWith('/test/user/p1');
  });
});
