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
  },
}));
