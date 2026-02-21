/**
 * Unit tests for stores/matches.ts — Matches Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMatchStore } from '@/lib/stores/matches';
import type { MatchedParticipant, MatchEntry } from '@/lib/stores/matches';

const mockPending: MatchedParticipant = {
  id: 'p2',
  displayName: 'Match User',
  photoUrl: 'https://example.com/photo.jpg',
};

const makeMatchEntry = (participantId: string): MatchEntry => ({
  participantId,
  participant: {
    id: participantId,
    event_id: 'event-1',
    display_name: `User ${participantId}`,
    gender: 'female' as any,
    attracted_to: 'men' as any,
    age: 25,
    bio: null,
    city: null,
    looking_for: null,
    is_banned: false,
    created_at: '',
    photos: [],
  },
  matchedAt: new Date().toISOString(),
});

beforeEach(() => {
  useMatchStore.getState().reset();
});

describe('useMatchStore', () => {
  it('initial state is null/empty', () => {
    const s = useMatchStore.getState();
    expect(s.pendingMatch).toBeNull();
    expect(s.matches).toEqual([]);
    expect(s.matchesLoaded).toBe(false);
  });

  it('setPendingMatch stores pending match', () => {
    useMatchStore.getState().setPendingMatch(mockPending);
    expect(useMatchStore.getState().pendingMatch).toEqual(mockPending);
  });

  it('clearPendingMatch clears pending match', () => {
    useMatchStore.getState().setPendingMatch(mockPending);
    useMatchStore.getState().clearPendingMatch();
    expect(useMatchStore.getState().pendingMatch).toBeNull();
  });

  it('setMatches stores matches and sets loaded flag', () => {
    const matches = [makeMatchEntry('p2'), makeMatchEntry('p3')];
    useMatchStore.getState().setMatches(matches);
    expect(useMatchStore.getState().matches).toHaveLength(2);
    expect(useMatchStore.getState().matchesLoaded).toBe(true);
  });

  it('removeMatch removes by participantId', () => {
    useMatchStore.getState().setMatches([makeMatchEntry('p2'), makeMatchEntry('p3')]);
    useMatchStore.getState().removeMatch('p2');
    const matches = useMatchStore.getState().matches;
    expect(matches).toHaveLength(1);
    expect(matches[0].participantId).toBe('p3');
  });

  it('removeMatch no-ops for non-existent participant', () => {
    useMatchStore.getState().setMatches([makeMatchEntry('p2')]);
    useMatchStore.getState().removeMatch('p999');
    expect(useMatchStore.getState().matches).toHaveLength(1);
  });

  it('reset clears all state', () => {
    useMatchStore.getState().setPendingMatch(mockPending);
    useMatchStore.getState().setMatches([makeMatchEntry('p2')]);
    useMatchStore.getState().reset();
    const s = useMatchStore.getState();
    expect(s.pendingMatch).toBeNull();
    expect(s.matches).toEqual([]);
    expect(s.matchesLoaded).toBe(false);
  });
});
