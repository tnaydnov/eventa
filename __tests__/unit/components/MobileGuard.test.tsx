/**
 * Unit tests for components/MobileGuard.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import MobileGuard from '@/components/MobileGuard';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MobileGuard', () => {
  it('renders children on mobile width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      configurable: true,
    });

    render(<MobileGuard><div>App content</div></MobileGuard>);
    expect(screen.getByText('App content')).toBeTruthy();
  });

  it('shows desktop block on wide screen with desktop UA', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true,
    });

    render(<MobileGuard><div>App content</div></MobileGuard>);
    expect(screen.getByText(/זמינה לנייד בלבד/)).toBeTruthy();
  });

  it('allows mobile UA even with wider screen', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 12) Mobile',
      configurable: true,
    });

    render(<MobileGuard><div>App content</div></MobileGuard>);
    expect(screen.getByText('App content')).toBeTruthy();
  });

  it('allows narrow screen even with desktop UA', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });

    render(<MobileGuard><div>App content</div></MobileGuard>);
    expect(screen.getByText('App content')).toBeTruthy();
  });

  it('updates on resize', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });

    render(<MobileGuard><div>App content</div></MobileGuard>);
    expect(screen.getByText(/זמינה לנייד בלבד/)).toBeTruthy();

    // Resize to mobile (debounced - advance timers to flush)
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('App content')).toBeTruthy();
    vi.useRealTimers();
  });
});
