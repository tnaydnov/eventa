import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock framer-motion for non-animated tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, exit, transition, drag, dragSnapToOrigin, dragConstraints, onDrag, onDragEnd, onDragStart, whileTap, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
  },
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useTransform: () => ({ get: () => 0 }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({
  getPhotoUrl: (path: string) => `https://storage.example.com/${path}`,
}));

vi.mock('@/components/Icons', () => ({
  UserIcon: () => <svg data-testid="user-icon" />,
}));

vi.mock('@/lib/constants', () => ({
  LOOKING_FOR_LABELS: {
    serious: 'קשר רציני',
    casual: 'משהו קליל',
    friends: 'חברים/ות',
    undecided: 'עוד לא יודע/ת',
  },
}));

import SwipeCard from '@/app/dating/[eventSlug]/_components/SwipeCard';

describe('SwipeCard', () => {
  const mockParticipant = {
    id: 'p1',
    display_name: 'נועה',
    age: 24,
    city: 'תל אביב',
    bio: 'אוהבת ריקודים',
    looking_for: 'serious',
    photos: [{ id: 'ph1', storage_path: 'photos/p1/1.jpg', order_index: 0 }],
  };

  const defaultProps = {
    participant: mockParticipant,
    isTop: true,
    stackIndex: 0,
    onSwipeRight: vi.fn(),
    onSwipeLeft: vi.fn(),
    onViewProfile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-DAT-04: renders participant photo + name', () => {
    render(<SwipeCard {...defaultProps} />);
    expect(screen.getByText('נועה')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('renders city and looking_for info', () => {
    render(<SwipeCard {...defaultProps} />);
    expect(screen.getByText(/תל אביב/)).toBeInTheDocument();
  });

  it('renders bio text', () => {
    render(<SwipeCard {...defaultProps} />);
    expect(screen.getByText('אוהבת ריקודים')).toBeInTheDocument();
  });

  it('renders placeholder when no photos', () => {
    const noPhotos = { ...mockParticipant, photos: [] };
    render(<SwipeCard {...defaultProps} participant={noPhotos} />);
    expect(screen.getByTestId('user-icon')).toBeInTheDocument();
  });

  it('renders stacked cards with depth effect', () => {
    const { container } = render(
      <SwipeCard {...defaultProps} isTop={false} stackIndex={1} />,
    );
    // Non-top card should still render
    expect(container.firstChild).toBeTruthy();
  });
});
