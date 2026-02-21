/**
 * Unit tests for hooks/useAppResume.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppResume } from '@/hooks/useAppResume';

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAppResume', () => {
  it('fires callback when page becomes visible', () => {
    const callback = vi.fn();
    renderHook(() => useAppResume(callback));

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not fire when page becomes hidden', () => {
    const callback = vi.fn();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    renderHook(() => useAppResume(callback));

    callback.mockClear();
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const callback = vi.fn();
    renderHook(() => useAppResume(callback, false));

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('uses latest callback (ref pattern)', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useAppResume(cb),
      { initialProps: { cb: callback1 } }
    );

    rerender({ cb: callback2 });

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('cleans up event listener on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useAppResume(callback));
    unmount();

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('fires multiple times on repeated visibility changes', () => {
    const callback = vi.fn();
    renderHook(() => useAppResume(callback));

    for (let i = 0; i < 3; i++) {
      act(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      act(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }

    expect(callback).toHaveBeenCalledTimes(3);
  });
});
