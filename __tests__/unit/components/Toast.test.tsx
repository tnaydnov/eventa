/**
 * Unit tests for components/Toast.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock store
let mockMessage: string | null = null;
vi.mock('@/lib/store', () => ({
  useToastStore: (selector: (s: { message: string | null }) => unknown) =>
    selector({ message: mockMessage }),
}));

// Mock Animations
vi.mock('@/components/Animations', () => ({
  AnimatedToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Toast from '@/components/Toast';

beforeEach(() => {
  mockMessage = null;
});

describe('Toast', () => {
  it('renders nothing when no message', () => {
    mockMessage = null;
    const { container } = render(<Toast />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders toast message when present', () => {
    mockMessage = 'Test toast';
    render(<Toast />);
    expect(screen.getByText('Test toast')).toBeTruthy();
  });

  it('renders with role="alert"', () => {
    mockMessage = 'Alert message';
    render(<Toast />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
