/**
 * Unit tests for hooks/useRealtimeHub.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUnsubscribe = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe }));

vi.mock('@/lib/realtimeHub', () => ({
  subscribe: mockSubscribe,
}));

import { useRealtimeHub } from '@/hooks/useRealtimeHub';

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });
  mockUnsubscribe.mockClear();
  mockSubscribe.mockClear();
});

describe('useRealtimeHub', () => {
  it('subscribes on mount when enabled', () => {
    renderHook(() =>
      useRealtimeHub({
        channelKey: 'test-channel',
        postgres: [{
          binding: { event: 'INSERT', schema: 'public', table: 'messages' },
          handler: vi.fn(),
        }],
      })
    );

    expect(mockSubscribe).toHaveBeenCalledWith('test-channel', expect.objectContaining({
      postgres: expect.arrayContaining([
        expect.objectContaining({
          binding: { event: 'INSERT', schema: 'public', table: 'messages' },
        }),
      ]),
    }));
  });

  it('does not subscribe when disabled', () => {
    renderHook(() =>
      useRealtimeHub({
        channelKey: 'test-channel',
        enabled: false,
      })
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeHub({
        channelKey: 'test-channel',
        postgres: [],
      })
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('re-subscribes when channelKey changes', () => {
    const { rerender } = renderHook(
      ({ key }) => useRealtimeHub({ channelKey: key, postgres: [] }),
      { initialProps: { key: 'channel-1' } }
    );

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    rerender({ key: 'channel-2' });
    // Should unsubscribe old and subscribe new
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
  });

  it('does not re-subscribe when only handler changes (ref pattern)', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(
      ({ h }) =>
        useRealtimeHub({
          channelKey: 'stable-channel',
          postgres: [{
            binding: { event: 'INSERT', schema: 'public', table: 'test' },
            handler: h,
          }],
        }),
      { initialProps: { h: handler1 } }
    );

    rerender({ h: handler2 });
    // channelKey didn't change, so no re-subscription
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles empty postgres array', () => {
    renderHook(() =>
      useRealtimeHub({
        channelKey: 'empty-channel',
        postgres: [],
      })
    );

    expect(mockSubscribe).toHaveBeenCalledWith('empty-channel', expect.objectContaining({
      postgres: [],
    }));
  });
});
