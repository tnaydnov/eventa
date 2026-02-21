/**
 * Unit tests for components/BlockConfirmDialog.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Animations
vi.mock('@/components/Animations', () => ({
  AnimatedOverlay: ({ children, isOpen, onClose }: { children: React.ReactNode; isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="overlay" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      </div>
    );
  },
}));

import BlockConfirmDialog from '@/components/BlockConfirmDialog';

describe('BlockConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    displayName: 'דני',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    defaultProps.onConfirm = vi.fn();
    defaultProps.onClose = vi.fn();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BlockConfirmDialog {...defaultProps} isOpen={false} />
    );
    expect(container.querySelector('[data-testid="overlay"]')).toBeNull();
  });

  it('renders dialog when open', () => {
    render(<BlockConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/חסימת דני\?/)).toBeTruthy();
  });

  it('displays the display name in the title', () => {
    render(<BlockConfirmDialog {...defaultProps} displayName="שרה" />);
    expect(screen.getByText(/חסימת שרה\?/)).toBeTruthy();
  });

  it('calls onClose then onConfirm when block button clicked', () => {
    render(<BlockConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('חסום'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button clicked', () => {
    render(<BlockConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('ביטול'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('shows warning text about consequences', () => {
    render(<BlockConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/החסימה תמחק את השיחה/)).toBeTruthy();
  });
});
