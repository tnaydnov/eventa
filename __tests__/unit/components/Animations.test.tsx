/**
 * Unit tests for components/Animations.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  LikeAnimation,
  AnimatedToast,
  AnimatedOverlay,
} from '@/components/Animations';

describe('PageTransition', () => {
  it('renders children', () => {
    render(<PageTransition>Page content</PageTransition>);
    expect(screen.getByText('Page content')).toBeTruthy();
  });

  it('applies className', () => {
    const { container } = render(<PageTransition className="custom">Content</PageTransition>);
    expect(container.querySelector('.custom')).toBeTruthy();
  });
});

describe('StaggerContainer', () => {
  it('renders children', () => {
    render(<StaggerContainer>Items</StaggerContainer>);
    expect(screen.getByText('Items')).toBeTruthy();
  });
});

describe('StaggerItem', () => {
  it('renders children', () => {
    render(<StaggerItem>Item</StaggerItem>);
    expect(screen.getByText('Item')).toBeTruthy();
  });

  it('handles onClick', () => {
    const onClick = vi.fn();
    render(<StaggerItem onClick={onClick}>Clickable</StaggerItem>);
    fireEvent.click(screen.getByText('Clickable'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('LikeAnimation', () => {
  it('renders SVG heart', () => {
    const { container } = render(<LikeAnimation liked={false} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('fills heart when liked', () => {
    const { container } = render(<LikeAnimation liked={true} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });

  it('does not fill heart when not liked', () => {
    const { container } = render(<LikeAnimation liked={false} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('fill')).toBe('none');
  });
});

describe('AnimatedToast', () => {
  it('renders message', () => {
    render(<AnimatedToast message="Test toast" />);
    expect(screen.getByText('Test toast')).toBeTruthy();
  });

  it('has role="status"', () => {
    render(<AnimatedToast message="Alert" />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('has aria-live="polite"', () => {
    render(<AnimatedToast message="Live" />);
    const toast = screen.getByRole('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });
});

describe('AnimatedOverlay', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AnimatedOverlay isOpen={false} onClose={vi.fn()}>
        Content
      </AnimatedOverlay>
    );
    expect(container.textContent).toBe('');
  });

  it('renders children when isOpen is true', () => {
    render(
      <AnimatedOverlay isOpen={true} onClose={vi.fn()}>
        Modal content
      </AnimatedOverlay>
    );
    expect(screen.getByText('Modal content')).toBeTruthy();
  });

  it('calls onClose when clicking overlay background', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AnimatedOverlay isOpen={true} onClose={onClose}>
        Content
      </AnimatedOverlay>
    );
    // Click the overlay (outer div)
    const overlay = container.querySelector('.modal-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inner content', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AnimatedOverlay isOpen={true} onClose={onClose}>
        <button>Inner</button>
      </AnimatedOverlay>
    );
    const inner = container.querySelector('.modal-content');
    if (inner) fireEvent.click(inner);
    expect(onClose).not.toHaveBeenCalled();
  });
});
