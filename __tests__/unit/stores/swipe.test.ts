/**
 * Unit tests for stores/swipe.ts - Swipe Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSwipeStore } from '@/lib/stores/swipe';

beforeEach(() => {
  useSwipeStore.getState().reset();
});

describe('useSwipeStore', () => {
  it('initial state', () => {
    const s = useSwipeStore.getState();
    expect(s.viewMode).toBe('grid');
    expect(s.dismissedIds.size).toBe(0);
    expect(s.likedIds.size).toBe(0);
    expect(s.pendingLikeIds.size).toBe(0);
    expect(s.likedIdsLoaded).toBe(false);
  });

  it('pending-like lifecycle works', () => {
    useSwipeStore.getState().startPendingLike('p1');
    expect(useSwipeStore.getState().pendingLikeIds.has('p1')).toBe(true);
    expect(useSwipeStore.getState().isPendingLike('p1')).toBe(true);

    useSwipeStore.getState().finishPendingLike('p1');
    expect(useSwipeStore.getState().pendingLikeIds.has('p1')).toBe(false);
    expect(useSwipeStore.getState().isPendingLike('p1')).toBe(false);
  });

  it('setViewMode changes mode', () => {
    useSwipeStore.getState().setViewMode('swipe');
    expect(useSwipeStore.getState().viewMode).toBe('swipe');
    useSwipeStore.getState().setViewMode('grid');
    expect(useSwipeStore.getState().viewMode).toBe('grid');
  });

  it('dismiss adds to dismissedIds', () => {
    useSwipeStore.getState().dismiss('p1');
    useSwipeStore.getState().dismiss('p2');
    expect(useSwipeStore.getState().dismissedIds.size).toBe(2);
    expect(useSwipeStore.getState().dismissedIds.has('p1')).toBe(true);
  });

  it('dismiss deduplicates', () => {
    useSwipeStore.getState().dismiss('p1');
    useSwipeStore.getState().dismiss('p1');
    expect(useSwipeStore.getState().dismissedIds.size).toBe(1);
  });

  it('addLiked adds to likedIds', () => {
    useSwipeStore.getState().addLiked('p1');
    expect(useSwipeStore.getState().likedIds.has('p1')).toBe(true);
    expect(useSwipeStore.getState().likedIds.size).toBe(1);
  });

  it('addLiked deduplicates', () => {
    useSwipeStore.getState().addLiked('p1');
    useSwipeStore.getState().addLiked('p1');
    expect(useSwipeStore.getState().likedIds.size).toBe(1);
  });

  it('removeLiked removes from likedIds', () => {
    useSwipeStore.getState().addLiked('p1');
    useSwipeStore.getState().addLiked('p2');
    useSwipeStore.getState().removeLiked('p1');
    expect(useSwipeStore.getState().likedIds.has('p1')).toBe(false);
    expect(useSwipeStore.getState().likedIds.has('p2')).toBe(true);
  });

  it('removeLiked no-ops for non-existent ID', () => {
    useSwipeStore.getState().addLiked('p1');
    useSwipeStore.getState().removeLiked('p999');
    expect(useSwipeStore.getState().likedIds.size).toBe(1);
  });

  it('setLikedIds bulk sets and marks loaded', () => {
    useSwipeStore.getState().setLikedIds(['p1', 'p2', 'p3']);
    expect(useSwipeStore.getState().likedIds.size).toBe(3);
    expect(useSwipeStore.getState().likedIdsLoaded).toBe(true);
  });

  it('resetPool clears dismissed but keeps liked', () => {
    useSwipeStore.getState().dismiss('p1');
    useSwipeStore.getState().dismiss('p2');
    useSwipeStore.getState().addLiked('p3');
    useSwipeStore.getState().resetPool();
    expect(useSwipeStore.getState().dismissedIds.size).toBe(0);
    expect(useSwipeStore.getState().likedIds.has('p3')).toBe(true);
  });

  it('reset clears everything', () => {
    useSwipeStore.getState().setViewMode('swipe');
    useSwipeStore.getState().dismiss('p1');
    useSwipeStore.getState().addLiked('p2');
    useSwipeStore.getState().startPendingLike('p4');
    useSwipeStore.getState().setLikedIds(['p3']);
    useSwipeStore.getState().reset();
    const s = useSwipeStore.getState();
    expect(s.viewMode).toBe('grid');
    expect(s.dismissedIds.size).toBe(0);
    expect(s.likedIds.size).toBe(0);
    expect(s.pendingLikeIds.size).toBe(0);
    expect(s.likedIdsLoaded).toBe(false);
  });
});
