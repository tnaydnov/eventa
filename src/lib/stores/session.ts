import { create } from 'zustand';
import type { Participant, ParticipantPhoto } from '../database.types';

export interface WeddingSession {
  eventId: string;
  eventSlug: string;
  eventName: string;
  participantId: string;
  backgroundImage?: string | null;
}

interface SessionState {
  session: WeddingSession | null;
  participant: Participant | null;
  photos: ParticipantPhoto[];
  setSession: (s: WeddingSession) => void;
  setParticipant: (p: Participant) => void;
  setPhotos: (ph: ParticipantPhoto[]) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  participant: null,
  photos: [],
  setSession: (session) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wedding_session', JSON.stringify(session));
    }
    set({ session });
  },
  setParticipant: (participant) => set({ participant }),
  setPhotos: (photos) => set({ photos }),
  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wedding_session');
    }
    set({ session: null, participant: null, photos: [] });

    // Reset ALL other stores to prevent stale data leak between sessions.
    // Dynamic import avoids circular dependency and is tree-shakeable (unlike require).
    import('./grid').then(({ useGridStore }) =>
      useGridStore.setState({ participants: [], filter: 'all' }));
    import('./chats').then(({ useChatsStore }) =>
      useChatsStore.setState({ conversations: [], currentMessages: [] }));
    import('./likes').then(({ useLikesStore }) =>
      useLikesStore.setState({ receivedLikes: [], sentLikes: [] }));
    import('./blocks').then(({ useBlocksStore }) =>
      useBlocksStore.setState({ blocks: [], blockedIds: new Set() }));
    import('./compass').then(({ useCompassStore }) =>
      useCompassStore.setState({ activeSession: null, otherLocation: null, myHeading: 0 }));
    import('./matches').then(({ useMatchStore }) =>
      useMatchStore.setState({ pendingMatch: null, matches: [], matchesLoaded: false }));
    import('./notifications').then(({ useNotificationStore }) =>
      useNotificationStore.setState({
        unreadLikes: 0,
        unreadMessages: 0,
        gridHighlights: [],
        _unreadConvoIds: new Set(),
        _initialized: false,
      }));
    import('./swipe').then(({ useSwipeStore }) =>
      useSwipeStore.setState({
        viewMode: 'grid',
        dismissedIds: new Set(),
        likedIds: new Set(),
        likedIdsLoaded: false,
      }));
  },
}));
