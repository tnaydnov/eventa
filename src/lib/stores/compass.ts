import { create } from 'zustand';
import type { CompassSession } from '../database.types';

interface CompassState {
  activeSession: CompassSession | null;
  otherLocation: { lat: number; lng: number; accuracy: number } | null;
  myHeading: number;
  setActiveSession: (s: CompassSession | null) => void;
  setOtherLocation: (loc: CompassState['otherLocation']) => void;
  setMyHeading: (h: number) => void;
}

export const useCompassStore = create<CompassState>((set) => ({
  activeSession: null,
  otherLocation: null,
  myHeading: 0,
  setActiveSession: (activeSession) => set({ activeSession }),
  setOtherLocation: (otherLocation) => set({ otherLocation }),
  setMyHeading: (myHeading) => set({ myHeading }),
}));
