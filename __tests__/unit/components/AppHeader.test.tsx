/**
 * Unit tests for components/AppHeader.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockSession: { eventSlug: string; eventName: string } | null = null;
vi.mock('@/lib/store', () => ({
  useSessionStore: (selector: (s: { session: typeof mockSession }) => unknown) =>
    selector({ session: mockSession }),
}));

import AppHeader from '@/components/AppHeader';

beforeEach(() => {
  vi.restoreAllMocks();
  mockSession = null;
  mockPush.mockClear();
});

describe('AppHeader', () => {
  it('renders nothing when no session', () => {
    mockSession = null;
    const { container } = render(<AppHeader />);
    expect(container.firstChild).toBeNull();
  });

  it('renders event name', () => {
    mockSession = { eventSlug: 'test-event', eventName: 'חתונת דני ושרה' };
    render(<AppHeader />);
    expect(screen.getByText('חתונת דני ושרה')).toBeTruthy();
  });

  it('renders default name when eventName is empty', () => {
    mockSession = { eventSlug: 'test', eventName: '' };
    render(<AppHeader />);
    expect(screen.getByText('Eventa')).toBeTruthy();
  });

  it('navigates to profile on button click', () => {
    mockSession = { eventSlug: 'my-event', eventName: 'Event' };
    render(<AppHeader />);
    const profileBtn = screen.getByRole('button');
    fireEvent.click(profileBtn);
    expect(mockPush).toHaveBeenCalledWith('/dating/my-event/profile');
  });
});
