import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockDeleteAccount = vi.fn();
const mockShow = vi.fn();

vi.mock('@/lib/api', () => ({
  deleteAccount: () => mockDeleteAccount(),
}));

vi.mock('@/lib/store', () => ({
  useToastStore: (sel: (s: any) => any) => sel({ show: mockShow }),
}));

vi.mock('@/components/Animations', () => ({
  AnimatedOverlay: ({ isOpen, children }: any) => isOpen ? <div data-testid="overlay">{children}</div> : null,
}));

vi.mock('@/components/Icons', () => ({
  TrashIcon: ({ size }: { size: number }) => <span data-testid="trash-icon" />,
}));

import DeleteAccountDialog from '@/app/[eventSlug]/profile/_components/DeleteAccountDialog';

describe('DeleteAccountDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onDeleted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-DAT-12: confirm triggers deleteAccount', async () => {
    mockDeleteAccount.mockResolvedValue({ ok: true });
    render(<DeleteAccountDialog {...defaultProps} />);

    const deleteBtn = screen.getByText('מחק לצמיתות');
    fireEvent.click(deleteBtn);

    // Wait for async
    await vi.waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled();
    });
  });

  it('calls onDeleted on success', async () => {
    mockDeleteAccount.mockResolvedValue({ ok: true });
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('מחק לצמיתות'));

    await vi.waitFor(() => {
      expect(defaultProps.onDeleted).toHaveBeenCalled();
    });
  });

  it('shows error on failure', async () => {
    mockDeleteAccount.mockResolvedValue({ ok: false });
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('מחק לצמיתות'));

    await vi.waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(expect.stringContaining('שגיאה'));
    });
  });

  it('cancel button calls onClose', () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('ביטול'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('not rendered when closed', () => {
    render(<DeleteAccountDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('מחיקת חשבון?')).not.toBeInTheDocument();
  });
});
