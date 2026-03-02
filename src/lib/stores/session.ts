import { create } from 'zustand';
import type { PublicParticipant, ParticipantPhoto } from '../database.types';

export interface WeddingSession {
  eventId: string;
  eventSlug: string;
  eventName: string;
  participantId: string;
  backgroundImage?: string | null;
  phone?: string | null;
}

interface SessionState {
  session: WeddingSession | null;
  participant: PublicParticipant | null;
  photos: ParticipantPhoto[];
  setSession: (s: WeddingSession) => void;
  setParticipant: (p: PublicParticipant) => void;
  setPhotos: (ph: ParticipantPhoto[]) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  participant: null,
  photos: [],
  setSession: (session) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eventa_session', JSON.stringify(session));
    }
    set({ session });
  },
  setParticipant: (participant) => set({ participant }),
  setPhotos: (photos) => set({ photos }),
  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eventa_session');
    }
    set({ session: null, participant: null, photos: [] });

    // Reset ALL other stores to prevent stale data leak between sessions.
    // Each store now owns its own reset() method - no duplicated initial state.
    import('./grid').then(({ useGridStore }) => useGridStore.getState().reset()).catch(() => {});
    import('./chats').then(({ useChatsStore }) => useChatsStore.getState().reset()).catch(() => {});
    import('./likes').then(({ useLikesStore }) => useLikesStore.getState().reset()).catch(() => {});
    import('./blocks').then(({ useBlocksStore }) => useBlocksStore.getState().reset()).catch(() => {});
    import('./matches').then(({ useMatchStore }) => useMatchStore.getState().reset()).catch(() => {});
    import('./notifications').then(({ useNotificationStore }) => useNotificationStore.getState().reset()).catch(() => {});
    import('./swipe').then(({ useSwipeStore }) => useSwipeStore.getState().reset()).catch(() => {});
    import('./toast').then(({ useToastStore }) => useToastStore.getState().reset()).catch(() => {});
  },
}));
