import { create } from 'zustand';

export interface GridHighlight {
  participantId: string;
  type: 'like' | 'message';
  timestamp: number;
}

interface NotificationState {
  unreadLikes: number;
  unreadMessages: number; // count of CONVERSATIONS with unread (for tab badge)
  gridHighlights: GridHighlight[];
  _unreadConvoIds: Set<string>; // internal: track which convos have unread
  _initialized: boolean;
  setUnreadLikes: (n: number) => void;
  setUnreadMessages: (n: number) => void;
  incrementLikes: () => void;
  decrementLikes: () => void;
  addUnreadConvo: (convoId: string) => void;
  removeUnreadConvo: (convoId: string) => void;
  initializeUnreadConvos: (convoIds: string[]) => void;
  clearUnreadLikes: () => void;
  addGridHighlight: (h: GridHighlight) => void;
  removeGridHighlight: (participantId: string) => void;
  removeGridHighlightByType: (participantId: string, type: 'like' | 'message') => void;
  setInitialized: (v: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadLikes: 0,
  unreadMessages: 0,
  gridHighlights: [],
  _unreadConvoIds: new Set(),
  _initialized: false,
  setUnreadLikes: (n) => set({ unreadLikes: n }),
  setUnreadMessages: (n) => set({ unreadMessages: n }),
  incrementLikes: () => set((s) => ({ unreadLikes: s.unreadLikes + 1 })),
  decrementLikes: () => set((s) => ({ unreadLikes: Math.max(0, s.unreadLikes - 1) })),
  addUnreadConvo: (convoId) =>
    set((s) => {
      const next = new Set(s._unreadConvoIds);
      next.add(convoId);
      return { _unreadConvoIds: next, unreadMessages: next.size };
    }),
  removeUnreadConvo: (convoId) =>
    set((s) => {
      const next = new Set(s._unreadConvoIds);
      next.delete(convoId);
      return { _unreadConvoIds: next, unreadMessages: next.size };
    }),
  initializeUnreadConvos: (convoIds) =>
    set({ _unreadConvoIds: new Set(convoIds), unreadMessages: convoIds.length }),
  clearUnreadLikes: () => set({ unreadLikes: 0 }),
  addGridHighlight: (h) =>
    set((s) => ({
      gridHighlights: [
        ...s.gridHighlights.filter((g) => !(g.participantId === h.participantId && g.type === h.type)),
        h,
      ],
    })),
  removeGridHighlight: (participantId) =>
    set((s) => ({
      gridHighlights: s.gridHighlights.filter((g) => g.participantId !== participantId),
    })),
  removeGridHighlightByType: (participantId, type) =>
    set((s) => ({
      gridHighlights: s.gridHighlights.filter(
        (g) => !(g.participantId === participantId && g.type === type)
      ),
    })),
  setInitialized: (v) => set({ _initialized: v }),
}));
