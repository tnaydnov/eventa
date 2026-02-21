import { create } from 'zustand';
import type { PublicParticipant, ParticipantPhoto } from '../database.types';

export interface GridParticipant extends PublicParticipant {
  photos: ParticipantPhoto[];
}

interface GridState {
  participants: GridParticipant[];
  filter: 'men' | 'women' | 'all';
  setParticipants: (p: GridParticipant[]) => void;
  setFilter: (f: 'men' | 'women' | 'all') => void;
  removeParticipant: (id: string) => void;
  addParticipant: (p: GridParticipant) => void;
  updateParticipant: (id: string, data: Partial<PublicParticipant>) => void;
  reset: () => void;
}

export const useGridStore = create<GridState>((set) => ({
  participants: [],
  filter: 'all',
  setParticipants: (participants) => set({ participants }),
  setFilter: (filter) => set({ filter }),
  removeParticipant: (id) =>
    set((s) => ({ participants: s.participants.filter((p) => p.id !== id) })),
  addParticipant: (p) =>
    set((s) => {
      // Avoid duplicates
      if (s.participants.some((existing) => existing.id === p.id)) return s;
      return { participants: [...s.participants, p] };
    }),
  updateParticipant: (id, data) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    })),
  reset: () => set({ participants: [], filter: 'all' }),
}));
