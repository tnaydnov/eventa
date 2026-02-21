/**
 * Unit tests for stores/toast.ts — Toast Zustand store
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore } from '@/lib/stores/toast';

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToastStore', () => {
  it('initial state: message is null', () => {
    expect(useToastStore.getState().message).toBeNull();
  });

  it('show sets message', () => {
    useToastStore.getState().show('Hello!');
    expect(useToastStore.getState().message).toBe('Hello!');
  });

  it('show auto-clears after default duration (3s)', () => {
    useToastStore.getState().show('Temporary');
    expect(useToastStore.getState().message).toBe('Temporary');
    vi.advanceTimersByTime(3001);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('show auto-clears after custom duration', () => {
    useToastStore.getState().show('Custom', 1000);
    vi.advanceTimersByTime(999);
    expect(useToastStore.getState().message).toBe('Custom');
    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('show replaces previous message and resets timer', () => {
    useToastStore.getState().show('First', 5000);
    vi.advanceTimersByTime(2000);
    useToastStore.getState().show('Second', 5000);
    vi.advanceTimersByTime(3000);
    // First timer (at 5s from start) should not fire since it was replaced
    expect(useToastStore.getState().message).toBe('Second');
    vi.advanceTimersByTime(2001);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('reset clears message and timer', () => {
    useToastStore.getState().show('Will be cleared', 10000);
    useToastStore.getState().reset();
    expect(useToastStore.getState().message).toBeNull();
    // Timer should not fire after reset
    vi.advanceTimersByTime(11000);
    expect(useToastStore.getState().message).toBeNull();
  });
});
