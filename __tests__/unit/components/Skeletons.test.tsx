/**
 * Unit tests for components/Skeletons.tsx
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GridSkeleton, ChatsSkeleton, LikesSkeleton } from '@/components/Skeletons';

describe('GridSkeleton', () => {
  it('renders default 6 placeholder items', () => {
    const { container } = render(<GridSkeleton />);
    const items = container.querySelectorAll('.profile-grid > div');
    expect(items).toHaveLength(6);
  });

  it('renders custom count', () => {
    const { container } = render(<GridSkeleton count={3} />);
    const items = container.querySelectorAll('.profile-grid > div');
    expect(items).toHaveLength(3);
  });
});

describe('ChatsSkeleton', () => {
  it('renders default 5 placeholder items', () => {
    const { container } = render(<ChatsSkeleton />);
    // Each item has a flex container with avatar and text lines
    const items = container.querySelectorAll('div > div > div');
    // 5 items × multiple children, just check root children
    const rootChildren = container.firstElementChild!.children;
    expect(rootChildren).toHaveLength(5);
  });

  it('renders custom count', () => {
    const { container } = render(<ChatsSkeleton count={2} />);
    const rootChildren = container.firstElementChild!.children;
    expect(rootChildren).toHaveLength(2);
  });
});

describe('LikesSkeleton', () => {
  it('renders default 4 placeholder items', () => {
    const { container } = render(<LikesSkeleton />);
    const items = container.querySelectorAll('.profile-grid > div');
    expect(items).toHaveLength(4);
  });

  it('renders custom count', () => {
    const { container } = render(<LikesSkeleton count={8} />);
    const items = container.querySelectorAll('.profile-grid > div');
    expect(items).toHaveLength(8);
  });
});
