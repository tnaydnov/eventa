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
  setParticipants: (participants) => set({ participants: participants.map((p) => ({ ...p, photos: p.photos ?? [] })) }),
  setFilter: (filter) => set({ filter }),
  removeParticipant: (id) =>
    set((s) => ({ participants: s.participants.filter((p) => p.id !== id) })),
  addParticipant: (p) =>
    set((s) => {
      // Avoid duplicates
      if (s.participants.some((existing) => existing.id === p.id)) return s;
      // Ensure photos is always an array (defensive guard against malformed data)
      const safe = { ...p, photos: p.photos ?? [] };
      return { participants: [...s.participants, safe] };
    }),
  updateParticipant: (id, data) =>
    set((s) => ({
      participants: s.participants.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...data };
        // Always ensure photos stays an array
        if (merged.photos == null) merged.photos = p.photos ?? [];
        return merged;
      }),
    })),
  reset: () => set({ participants: [], filter: 'all' }),
}));
