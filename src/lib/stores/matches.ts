import { create } from 'zustand';
import type { Participant, ParticipantPhoto } from '../database.types';

/* ── Types ─────────────────────────────────────────────────────── */

/** Minimal participant snapshot shown in the match popup. */
export interface MatchedParticipant {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

/** A hydrated match row for the matches tab (participant + photos). */
export interface MatchEntry {
  participantId: string;
  participant: Participant & { photos: ParticipantPhoto[] };
  matchedAt: string; // ISO timestamp of the more-recent of the two likes
}

/* ── Store ──────────────────────────────────────────────────────── */

interface MatchState {
  /**
   * Pending match waiting to be shown as a fullscreen popup.
   * Set by the like handler (self-initiated) or realtime listener (other-initiated).
   * Cleared by the popup on dismiss or "send message".
   */
  pendingMatch: MatchedParticipant | null;

  /** Hydrated list for the matches tab on the likes page. */
  matches: MatchEntry[];
  matchesLoaded: boolean;

  setPendingMatch: (m: MatchedParticipant | null) => void;
  clearPendingMatch: () => void;
  setMatches: (m: MatchEntry[]) => void;
  /** Remove a match by participant ID (when a like is removed). */
  removeMatch: (participantId: string) => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  pendingMatch: null,
  matches: [],
  matchesLoaded: false,

  setPendingMatch: (pendingMatch) => set({ pendingMatch }),
  clearPendingMatch: () => set({ pendingMatch: null }),

  setMatches: (matches) => set({ matches, matchesLoaded: true }),

  removeMatch: (participantId) =>
    set((s) => ({
      matches: s.matches.filter((m) => m.participantId !== participantId),
    })),
}));
