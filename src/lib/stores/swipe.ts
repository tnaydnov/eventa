import { create } from 'zustand';

/**
 * Swipe-mode store - manages the Tinder-style card view state.
 *
 * - `viewMode` toggles between the classic grid and the swipe deck.
 * - `dismissedIds` tracks participants swiped-left (skipped) - reset‐able.
 * - `likedIds` tracks participants swiped-right (liked) - persists across resets.
 *
 * Both sets are scoped to the current session; changing events or
 * refreshing the browser naturally resets the in-memory store.
 */

interface SwipeState {
  /** Current view mode on the main event page. */
  viewMode: 'grid' | 'swipe';
  /** Participant IDs the user swiped left on (skipped). */
  dismissedIds: Set<string>;
  /** Participant IDs the user swiped right on (liked via swipe). */
  likedIds: Set<string>;
  /** Participant IDs with an in-flight like request. */
  pendingLikeIds: Set<string>;
  /** Whether the initial sent-likes have been loaded from the API. */
  likedIdsLoaded: boolean;

  setViewMode: (mode: 'grid' | 'swipe') => void;
  /** Record a left-swipe (skip). */
  dismiss: (id: string) => void;
  /** Record a right-swipe (like). */
  addLiked: (id: string) => void;
  /** Remove a liked ID (e.g. when unliking from profile). */
  removeLiked: (id: string) => void;
  /** Mark like request as in-flight for a participant. */
  startPendingLike: (id: string) => void;
  /** Clear in-flight like state for a participant. */
  finishPendingLike: (id: string) => void;
  /** Read whether a like request is currently in-flight. */
  isPendingLike: (id: string) => boolean;
  /** Bulk-seed liked IDs from the server on first load. */
  setLikedIds: (ids: string[]) => void;
  /** Reset the pool - clears dismissed, keeps liked. */
  resetPool: () => void;
  /** Full store reset (for session clear). */
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  viewMode: 'grid',
  dismissedIds: new Set(),
  likedIds: new Set(),
  pendingLikeIds: new Set(),
  likedIdsLoaded: false,

  setViewMode: (viewMode) => set({ viewMode }),

  dismiss: (id) =>
    set((s) => {
      const next = new Set(s.dismissedIds);
      next.add(id);
      return { dismissedIds: next };
    }),

  addLiked: (id) =>
    set((s) => {
      const next = new Set(s.likedIds);
      next.add(id);
      return { likedIds: next };
    }),

  removeLiked: (id) =>
    set((s) => {
      const next = new Set(s.likedIds);
      next.delete(id);
      return { likedIds: next };
    }),

  startPendingLike: (id) =>
    set((s) => {
      const next = new Set(s.pendingLikeIds);
      next.add(id);
      return { pendingLikeIds: next };
    }),

  finishPendingLike: (id) =>
    set((s) => {
      const next = new Set(s.pendingLikeIds);
      next.delete(id);
      return { pendingLikeIds: next };
    }),

  isPendingLike: (id) => get().pendingLikeIds.has(id),

  setLikedIds: (ids) =>
    set({ likedIds: new Set(ids), likedIdsLoaded: true }),

  resetPool: () => set({ dismissedIds: new Set() }),
  reset: () => set({
    viewMode: 'grid',
    dismissedIds: new Set(),
    likedIds: new Set(),
    pendingLikeIds: new Set(),
    likedIdsLoaded: false,
  }),
}));
