/**
 * Unit tests for stores/blocks.ts - Blocks Zustand store
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock session store before importing blocks
vi.mock('@/lib/stores/session', () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      session: { participantId: 'my-id' },
    })),
  },
}));

import { useBlocksStore } from '@/lib/stores/blocks';
import type { Block } from '@/lib/database.types';

const makeBlock = (blockerId: string, blockedId: string): Block => ({
  id: `block-${blockerId}-${blockedId}`,
  event_id: 'event-1',
  blocker_id: blockerId,
  blocked_id: blockedId,
  created_at: new Date().toISOString(),
});

beforeEach(() => {
  useBlocksStore.getState().reset();
});

describe('useBlocksStore', () => {
  it('initial state is empty', () => {
    const s = useBlocksStore.getState();
    expect(s.blocks).toEqual([]);
    expect(s.blockedIds.size).toBe(0);
  });

  it('setBlocks builds blockedIds set', () => {
    useBlocksStore.getState().setBlocks([
      makeBlock('my-id', 'p2'),
      makeBlock('p3', 'my-id'),
    ]);
    const s = useBlocksStore.getState();
    expect(s.blocks).toHaveLength(2);
    // blockedIds should contain p2 and p3 but NOT my-id
    expect(s.blockedIds.has('p2')).toBe(true);
    expect(s.blockedIds.has('p3')).toBe(true);
    expect(s.blockedIds.has('my-id')).toBe(false);
  });

  it('setBlocks excludes self from blockedIds', () => {
    useBlocksStore.getState().setBlocks([makeBlock('my-id', 'p2')]);
    expect(useBlocksStore.getState().blockedIds.has('my-id')).toBe(false);
  });

  it('setBlocks handles empty array', () => {
    useBlocksStore.getState().setBlocks([]);
    const s = useBlocksStore.getState();
    expect(s.blocks).toEqual([]);
    expect(s.blockedIds.size).toBe(0);
  });

  it('reset clears all state', () => {
    useBlocksStore.getState().setBlocks([makeBlock('my-id', 'p2')]);
    useBlocksStore.getState().reset();
    expect(useBlocksStore.getState().blocks).toEqual([]);
    expect(useBlocksStore.getState().blockedIds.size).toBe(0);
  });
});
