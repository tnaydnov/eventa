/**
 * Unit tests for components/NetworkStatus.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import NetworkStatus from '@/components/NetworkStatus';

beforeEach(() => {
  vi.useFakeTimers();
  // Default to online
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NetworkStatus', () => {
  it('renders nothing when online', () => {
    const { container } = render(<NetworkStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('shows offline message when going offline', () => {
    const { container } = render(<NetworkStatus />);
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/אין חיבור לאינטרנט/)).toBeTruthy();
  });

  it('shows reconnected message when coming back online', () => {
    const { container } = render(<NetworkStatus />);

    // Go offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Come back online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByText(/חזרתם לרשת/)).toBeTruthy();
  });

  it('hides reconnected message after 3 seconds', () => {
    const { container } = render(<NetworkStatus />);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByText(/חזרתם לרשת/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(container.firstChild).toBeNull();
  });
});
