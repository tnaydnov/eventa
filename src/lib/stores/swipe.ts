import { create } from 'zustand';

/**
 * Swipe-mode store — manages the Tinder-style card view state.
 *
 * - `viewMode` toggles between the classic grid and the swipe deck.
 * - `dismissedIds` tracks participants swiped-left (skipped) — reset‐able.
 * - `likedIds` tracks participants swiped-right (liked) — persists across resets.
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
  /** Whether the initial sent-likes have been loaded from the API. */
  likedIdsLoaded: boolean;

  setViewMode: (mode: 'grid' | 'swipe') => void;
  /** Record a left-swipe (skip). */
  dismiss: (id: string) => void;
  /** Record a right-swipe (like). */
  addLiked: (id: string) => void;
  /** Remove a liked ID (e.g. when unliking from profile). */
  removeLiked: (id: string) => void;
  /** Bulk-seed liked IDs from the server on first load. */
  setLikedIds: (ids: string[]) => void;
  /** Reset the pool — clears dismissed, keeps liked. */
  resetPool: () => void;
  /** Full store reset (for session clear). */
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set) => ({
  viewMode: 'grid',
  dismissedIds: new Set(),
  likedIds: new Set(),
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

  setLikedIds: (ids) =>
    set({ likedIds: new Set(ids), likedIdsLoaded: true }),

  resetPool: () => set({ dismissedIds: new Set() }),
  reset: () => set({
    viewMode: 'grid',
    dismissedIds: new Set(),
    likedIds: new Set(),
    likedIdsLoaded: false,
  }),
}));
