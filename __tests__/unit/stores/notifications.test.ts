/**
 * Unit tests for stores/notifications.ts - Notifications Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '@/lib/stores/notifications';
import type { GridHighlight } from '@/lib/stores/notifications';

beforeEach(() => {
  useNotificationStore.getState().reset();
});

describe('useNotificationStore', () => {
  it('initial state has zeros', () => {
    const s = useNotificationStore.getState();
    expect(s.unreadLikes).toBe(0);
    expect(s.unreadMessages).toBe(0);
    expect(s.gridHighlights).toEqual([]);
    expect(s._initialized).toBe(false);
  });

  it('setUnreadLikes sets count', () => {
    useNotificationStore.getState().setUnreadLikes(5);
    expect(useNotificationStore.getState().unreadLikes).toBe(5);
  });

  it('setUnreadMessages sets count', () => {
    useNotificationStore.getState().setUnreadMessages(3);
    expect(useNotificationStore.getState().unreadMessages).toBe(3);
  });

  it('incrementLikes adds 1', () => {
    useNotificationStore.getState().setUnreadLikes(2);
    useNotificationStore.getState().incrementLikes();
    expect(useNotificationStore.getState().unreadLikes).toBe(3);
  });

  it('decrementLikes subtracts 1', () => {
    useNotificationStore.getState().setUnreadLikes(2);
    useNotificationStore.getState().decrementLikes();
    expect(useNotificationStore.getState().unreadLikes).toBe(1);
  });

  it('decrementLikes does not go below 0', () => {
    useNotificationStore.getState().setUnreadLikes(0);
    useNotificationStore.getState().decrementLikes();
    expect(useNotificationStore.getState().unreadLikes).toBe(0);
  });

  it('addUnreadConvo adds convo ID and increments messages', () => {
    useNotificationStore.getState().addUnreadConvo('c1');
    expect(useNotificationStore.getState().unreadMessages).toBe(1);
    useNotificationStore.getState().addUnreadConvo('c2');
    expect(useNotificationStore.getState().unreadMessages).toBe(2);
  });

  it('addUnreadConvo deduplicates', () => {
    useNotificationStore.getState().addUnreadConvo('c1');
    useNotificationStore.getState().addUnreadConvo('c1');
    expect(useNotificationStore.getState().unreadMessages).toBe(1);
  });

  it('removeUnreadConvo decrements messages', () => {
    useNotificationStore.getState().addUnreadConvo('c1');
    useNotificationStore.getState().addUnreadConvo('c2');
    useNotificationStore.getState().removeUnreadConvo('c1');
    expect(useNotificationStore.getState().unreadMessages).toBe(1);
  });

  it('removeUnreadConvo no-ops for non-existent convo', () => {
    useNotificationStore.getState().addUnreadConvo('c1');
    useNotificationStore.getState().removeUnreadConvo('c999');
    expect(useNotificationStore.getState().unreadMessages).toBe(1);
  });

  it('initializeUnreadConvos bulk sets', () => {
    useNotificationStore.getState().initializeUnreadConvos(['c1', 'c2', 'c3']);
    expect(useNotificationStore.getState().unreadMessages).toBe(3);
  });

  it('clearUnreadLikes resets to 0', () => {
    useNotificationStore.getState().setUnreadLikes(10);
    useNotificationStore.getState().clearUnreadLikes();
    expect(useNotificationStore.getState().unreadLikes).toBe(0);
  });

  it('addGridHighlight adds highlight', () => {
    const h: GridHighlight = { participantId: 'p1', type: 'like', timestamp: Date.now() };
    useNotificationStore.getState().addGridHighlight(h);
    expect(useNotificationStore.getState().gridHighlights).toHaveLength(1);
  });

  it('addGridHighlight replaces duplicate type for same participant', () => {
    const h1: GridHighlight = { participantId: 'p1', type: 'like', timestamp: 1 };
    const h2: GridHighlight = { participantId: 'p1', type: 'like', timestamp: 2 };
    useNotificationStore.getState().addGridHighlight(h1);
    useNotificationStore.getState().addGridHighlight(h2);
    const highlights = useNotificationStore.getState().gridHighlights;
    expect(highlights).toHaveLength(1);
    expect(highlights[0].timestamp).toBe(2);
  });

  it('addGridHighlight allows different types for same participant', () => {
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'like', timestamp: 1 });
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'message', timestamp: 2 });
    expect(useNotificationStore.getState().gridHighlights).toHaveLength(2);
  });

  it('removeGridHighlight removes all highlights for participant', () => {
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'like', timestamp: 1 });
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'message', timestamp: 2 });
    useNotificationStore.getState().removeGridHighlight('p1');
    expect(useNotificationStore.getState().gridHighlights).toHaveLength(0);
  });

  it('removeGridHighlightByType removes only specific type', () => {
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'like', timestamp: 1 });
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'message', timestamp: 2 });
    useNotificationStore.getState().removeGridHighlightByType('p1', 'like');
    const highlights = useNotificationStore.getState().gridHighlights;
    expect(highlights).toHaveLength(1);
    expect(highlights[0].type).toBe('message');
  });

  it('setInitialized sets flag', () => {
    useNotificationStore.getState().setInitialized(true);
    expect(useNotificationStore.getState()._initialized).toBe(true);
  });

  it('reset clears all state', () => {
    useNotificationStore.getState().setUnreadLikes(5);
    useNotificationStore.getState().addUnreadConvo('c1');
    useNotificationStore.getState().addGridHighlight({ participantId: 'p1', type: 'like', timestamp: 1 });
    useNotificationStore.getState().setInitialized(true);
    useNotificationStore.getState().reset();
    const s = useNotificationStore.getState();
    expect(s.unreadLikes).toBe(0);
    expect(s.unreadMessages).toBe(0);
    expect(s.gridHighlights).toEqual([]);
    expect(s._initialized).toBe(false);
  });
});
