import type { GridParticipant } from '../store';

/**
 * Cross-attraction matching — kept client-side for filtering in realtime delta updates.
 */
export function matchesCrossAttraction(
  me: { gender: string; attracted_to: string },
  other: { gender: string; attracted_to: string }
): boolean {
  const iAmAttractedToThem =
    me.attracted_to === 'all' ||
    (other.gender === 'male' && me.attracted_to === 'men') ||
    (other.gender === 'female' && me.attracted_to === 'women');

  const theyAreAttractedToMe =
    other.attracted_to === 'all' ||
    (me.gender === 'male' && other.attracted_to === 'men') ||
    (me.gender === 'female' && other.attracted_to === 'women');

  return iAmAttractedToThem && theyAreAttractedToMe;
}

/** Fetch all visible participants in the grid via the server-side participants endpoint (handles decryption). */
export async function getGridParticipants(
  eventId: string,
  _myId: string
): Promise<GridParticipant[]> {
  try {
    const res = await fetch(`/api/secure/participants?eventId=${encodeURIComponent(eventId)}`);
    if (!res.ok) {
      console.error('[getGridParticipants] participants error:', res.status);
      return [];
    }
    return res.json();
  } catch (err) {
    console.error('[getGridParticipants] fetch error:', err);
    return [];
  }
}
