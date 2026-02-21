/**
 * Unit tests for stores/grid.ts — Grid Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGridStore } from '@/lib/stores/grid';
import type { GridParticipant } from '@/lib/stores/grid';

const makeParticipant = (id: string, gender = 'male'): GridParticipant => ({
  id,
  event_id: 'event-1',
  display_name: `User ${id}`,
  gender: gender as any,
  attracted_to: 'all' as any,
  age: 25,
  bio: null,
  city: null,
  looking_for: null,
  is_banned: false,
  created_at: new Date().toISOString(),
  photos: [],
});

beforeEach(() => {
  useGridStore.getState().reset();
});

describe('useGridStore', () => {
  it('initial state is empty', () => {
    const s = useGridStore.getState();
    expect(s.participants).toEqual([]);
    expect(s.filter).toBe('all');
  });

  it('setParticipants sets participant list', () => {
    const participants = [makeParticipant('1'), makeParticipant('2')];
    useGridStore.getState().setParticipants(participants);
    expect(useGridStore.getState().participants).toHaveLength(2);
  });

  it('setFilter changes filter', () => {
    useGridStore.getState().setFilter('men');
    expect(useGridStore.getState().filter).toBe('men');
    useGridStore.getState().setFilter('women');
    expect(useGridStore.getState().filter).toBe('women');
    useGridStore.getState().setFilter('all');
    expect(useGridStore.getState().filter).toBe('all');
  });

  it('removeParticipant removes by ID', () => {
    useGridStore.getState().setParticipants([makeParticipant('1'), makeParticipant('2')]);
    useGridStore.getState().removeParticipant('1');
    const remaining = useGridStore.getState().participants;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('2');
  });

  it('removeParticipant no-ops for non-existent ID', () => {
    useGridStore.getState().setParticipants([makeParticipant('1')]);
    useGridStore.getState().removeParticipant('999');
    expect(useGridStore.getState().participants).toHaveLength(1);
  });

  it('addParticipant adds new participant', () => {
    useGridStore.getState().addParticipant(makeParticipant('1'));
    expect(useGridStore.getState().participants).toHaveLength(1);
  });

  it('addParticipant prevents duplicates', () => {
    const p = makeParticipant('1');
    useGridStore.getState().addParticipant(p);
    useGridStore.getState().addParticipant(p);
    expect(useGridStore.getState().participants).toHaveLength(1);
  });

  it('updateParticipant merges data', () => {
    useGridStore.getState().setParticipants([makeParticipant('1')]);
    useGridStore.getState().updateParticipant('1', { display_name: 'Updated' });
    expect(useGridStore.getState().participants[0].display_name).toBe('Updated');
  });

  it('updateParticipant no-ops for non-existent ID', () => {
    useGridStore.getState().setParticipants([makeParticipant('1')]);
    useGridStore.getState().updateParticipant('999', { display_name: 'Ghost' });
    expect(useGridStore.getState().participants[0].display_name).toBe('User 1');
  });

  it('reset clears participants and resets filter', () => {
    useGridStore.getState().setParticipants([makeParticipant('1')]);
    useGridStore.getState().setFilter('men');
    useGridStore.getState().reset();
    const s = useGridStore.getState();
    expect(s.participants).toEqual([]);
    expect(s.filter).toBe('all');
  });
});
