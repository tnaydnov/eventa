/**
 * Unit tests for components/TabBar.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/test-event';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockSession: { eventSlug: string } | null = { eventSlug: 'test-event' };
let mockUnreadLikes = 0;
let mockUnreadMessages = 0;

vi.mock('@/lib/store', () => ({
  useSessionStore: (selector: (s: { session: typeof mockSession }) => unknown) =>
    selector({ session: mockSession }),
  useNotificationStore: (selector: (s: { unreadLikes: number; unreadMessages: number }) => unknown) =>
    selector({ unreadLikes: mockUnreadLikes, unreadMessages: mockUnreadMessages }),
}));

import TabBar from '@/components/TabBar';

beforeEach(() => {
  mockSession = { eventSlug: 'test-event' };
  mockUnreadLikes = 0;
  mockUnreadMessages = 0;
  mockPathname = '/test-event';
});

describe('TabBar', () => {
  it('renders nothing when no session', () => {
    mockSession = null;
    const { container } = render(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders three tabs', () => {
    render(<TabBar />);
    expect(screen.getByText('גריד')).toBeTruthy();
    expect(screen.getByText('צ׳אטים')).toBeTruthy();
    expect(screen.getByText('לייקים')).toBeTruthy();
  });

  it('marks active tab based on current path', () => {
    mockPathname = '/test-event';
    const { container } = render(<TabBar />);
    const links = container.querySelectorAll('a');
    const gridLink = Array.from(links).find(l => l.getAttribute('href') === '/test-event');
    expect(gridLink?.classList.contains('active')).toBe(true);
  });

  it('shows badge for unread likes', () => {
    mockUnreadLikes = 5;
    render(<TabBar />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows badge for unread messages', () => {
    mockUnreadMessages = 3;
    render(<TabBar />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows 9+ for badges above 9', () => {
    mockUnreadLikes = 15;
    render(<TabBar />);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('hides badges when counts are 0', () => {
    mockUnreadLikes = 0;
    mockUnreadMessages = 0;
    const { container } = render(<TabBar />);
    // No badge spans should exist
    const badges = container.querySelectorAll('span[style*="position: absolute"]');
    expect(badges).toHaveLength(0);
  });

  it('uses correct tab paths', () => {
    const { container } = render(<TabBar />);
    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map(l => l.getAttribute('href'));
    expect(hrefs).toContain('/test-event');
    expect(hrefs).toContain('/test-event/chats');
    expect(hrefs).toContain('/test-event/likes');
  });
});
