/**
 * Unit tests for stores/likes.ts — Likes Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useLikesStore } from '@/lib/stores/likes';

const makeLike = (fromId: string, toId: string) => ({
  id: `like-${fromId}-${toId}`,
  event_id: 'event-1',
  from_participant_id: fromId,
  to_participant_id: toId,
  is_seen: false,
  created_at: new Date().toISOString(),
});

const makeParticipant = (id: string) => ({
  id,
  event_id: 'event-1',
  display_name: `User ${id}`,
  gender: 'male' as const,
  attracted_to: 'all' as const,
  age: 25,
  bio: null,
  city: null,
  looking_for: null,
  is_banned: false,
  created_at: '',
  photos: [],
});

beforeEach(() => {
  useLikesStore.getState().reset();
});

describe('useLikesStore', () => {
  it('initial state is empty', () => {
    const s = useLikesStore.getState();
    expect(s.receivedLikes).toEqual([]);
    expect(s.sentLikes).toEqual([]);
  });

  it('setReceivedLikes stores received likes', () => {
    const likes = [{ ...makeLike('p2', 'p1'), from: makeParticipant('p2') }];
    useLikesStore.getState().setReceivedLikes(likes as any);
    expect(useLikesStore.getState().receivedLikes).toHaveLength(1);
  });

  it('setSentLikes stores sent likes', () => {
    const likes = [{ ...makeLike('p1', 'p2'), to: makeParticipant('p2') }];
    useLikesStore.getState().setSentLikes(likes as any);
    expect(useLikesStore.getState().sentLikes).toHaveLength(1);
  });

  it('removeParticipantLikes removes from both directions', () => {
    useLikesStore.getState().setReceivedLikes([
      { ...makeLike('p2', 'p1'), from: makeParticipant('p2') },
      { ...makeLike('p3', 'p1'), from: makeParticipant('p3') },
    ] as any);
    useLikesStore.getState().setSentLikes([
      { ...makeLike('p1', 'p2'), to: makeParticipant('p2') },
      { ...makeLike('p1', 'p4'), to: makeParticipant('p4') },
    ] as any);

    useLikesStore.getState().removeParticipantLikes('p2');

    expect(useLikesStore.getState().receivedLikes).toHaveLength(1);
    expect(useLikesStore.getState().receivedLikes[0].from_participant_id).toBe('p3');
    expect(useLikesStore.getState().sentLikes).toHaveLength(1);
    expect(useLikesStore.getState().sentLikes[0].to_participant_id).toBe('p4');
  });

  it('removeParticipantLikes no-ops for non-existent participant', () => {
    useLikesStore.getState().setReceivedLikes([
      { ...makeLike('p2', 'p1'), from: makeParticipant('p2') },
    ] as any);
    useLikesStore.getState().removeParticipantLikes('p999');
    expect(useLikesStore.getState().receivedLikes).toHaveLength(1);
  });

  it('reset clears all state', () => {
    useLikesStore.getState().setReceivedLikes([
      { ...makeLike('p2', 'p1'), from: makeParticipant('p2') },
    ] as any);
    useLikesStore.getState().setSentLikes([
      { ...makeLike('p1', 'p2'), to: makeParticipant('p2') },
    ] as any);
    useLikesStore.getState().reset();
    expect(useLikesStore.getState().receivedLikes).toEqual([]);
    expect(useLikesStore.getState().sentLikes).toEqual([]);
  });
});
