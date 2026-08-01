/**
 * Unit tests for components/HeartbeatPinger.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

let mockParticipantId: string | null = null;
let mockEventSlug: string | null = null;

vi.mock('@/lib/store', () => ({
  useSessionStore: Object.assign(
    (selector: (s: any) => unknown) =>
      selector({
        session: mockParticipantId
          ? { participantId: mockParticipantId, eventSlug: mockEventSlug }
          : null,
      }),
    {
      getState: () => ({
        clearSession: vi.fn(),
        session: mockParticipantId
          ? { participantId: mockParticipantId, eventSlug: mockEventSlug }
          : null,
      }),
    }
  ),
}));

import HeartbeatPinger from '@/components/HeartbeatPinger';

beforeEach(() => {
  vi.useFakeTimers();
  mockParticipantId = 'p1';
  mockEventSlug = 'test-event';
  Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200 } as Response);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('HeartbeatPinger', () => {
  it('renders nothing (invisible component)', () => {
    const { container } = render(<HeartbeatPinger />);
    expect(container.firstChild).toBeNull();
  });

  it('sends immediate heartbeat on mount', () => {
    render(<HeartbeatPinger />);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/secure/heartbeat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends heartbeat at intervals', () => {
    render(<HeartbeatPinger />);
    vi.clearAllMocks();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('does not send heartbeat when no participantId', () => {
    mockParticipantId = null;
    vi.clearAllMocks();
    render(<HeartbeatPinger />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not send heartbeat when tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    vi.clearAllMocks();
    render(<HeartbeatPinger />);
    // The send function checks visibilityState and skips if hidden
    // Immediate mount heartbeat is skipped
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sends heartbeat on visibility change to visible', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    render(<HeartbeatPinger />);
    vi.clearAllMocks();

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
