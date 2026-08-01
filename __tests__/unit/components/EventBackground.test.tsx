/**
 * Unit tests for components/EventBackground.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

let mockBgImage: string | null = null;
vi.mock('@/lib/store', () => ({
  useSessionStore: (selector: (s: { session: { backgroundImage: string | null } | null }) => unknown) =>
    selector({ session: mockBgImage ? { backgroundImage: mockBgImage } : null }),
}));

import EventBackground from '@/components/EventBackground';

beforeEach(() => {
  mockBgImage = null;
});

describe('EventBackground', () => {
  it('renders nothing when no background image', () => {
    mockBgImage = null;
    const { container } = render(<EventBackground />);
    expect(container.firstChild).toBeNull();
  });

  it('renders background container when image exists', () => {
    mockBgImage = 'https://example.com/bg.jpg';
    const { container } = render(<EventBackground />);
    expect(container.querySelector('[aria-hidden]')).toBeTruthy();
  });

  it('sets background-image style', () => {
    mockBgImage = 'https://example.com/bg.jpg';
    const { container } = render(<EventBackground />);
    const bg = container.querySelector('[aria-hidden]') as HTMLElement;
    expect(bg.style.backgroundImage).toContain('https://example.com/bg.jpg');
  });

  it('adds data-event-bg attribute for CSS overrides', () => {
    mockBgImage = 'https://example.com/bg.jpg';
    const { container } = render(<EventBackground />);
    expect(container.querySelector('[data-event-bg]')).toBeTruthy();
  });
});
