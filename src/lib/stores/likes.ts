import { create } from 'zustand';
import type { Like, Participant, ParticipantPhoto } from '../database.types';

interface LikesState {
  receivedLikes: (Like & { from: Participant & { photos: ParticipantPhoto[] } })[];
  sentLikes: (Like & { to: Participant & { photos: ParticipantPhoto[] } })[];
  setReceivedLikes: (l: LikesState['receivedLikes']) => void;
  setSentLikes: (l: LikesState['sentLikes']) => void;
  removeParticipantLikes: (participantId: string) => void;
}

export const useLikesStore = create<LikesState>((set) => ({
  receivedLikes: [],
  sentLikes: [],
  setReceivedLikes: (receivedLikes) => set({ receivedLikes }),
  setSentLikes: (sentLikes) => set({ sentLikes }),
  removeParticipantLikes: (participantId) =>
    set((s) => ({
      receivedLikes: s.receivedLikes.filter((l) => l.from_participant_id !== participantId),
      sentLikes: s.sentLikes.filter((l) => l.to_participant_id !== participantId),
    })),
}));
