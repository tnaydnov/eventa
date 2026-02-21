import { create } from 'zustand';
import type { Block } from '../database.types';
import { useSessionStore } from './session';

interface BlocksState {
  blocks: Block[];
  blockedIds: Set<string>;
  setBlocks: (b: Block[]) => void;
  reset: () => void;
}

const INITIAL_BLOCKS_STATE = { blocks: [] as Block[], blockedIds: new Set<string>() };

export const useBlocksStore = create<BlocksState>((set) => ({
  ...INITIAL_BLOCKS_STATE,
  setBlocks: (blocks) => {
    const ids = new Set<string>();
    blocks.forEach((b) => {
      ids.add(b.blocker_id);
      ids.add(b.blocked_id);
    });
    // Remove self from blockedIds — current user's ID gets added
    // because they appear in blocks they created. Components should
    // only filter OTHER users via blockedIds.
    const session = useSessionStore.getState().session;
    if (session) ids.delete(session.participantId);
    set({ blocks, blockedIds: ids });
  },
  reset: () => set({ blocks: [], blockedIds: new Set() }),
}));
