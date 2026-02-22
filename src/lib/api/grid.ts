import { supabase } from '../supabase';
import type { GridParticipant } from '../store';
import type { ParticipantPhoto } from '../database.types';
import { getBlockedIds } from './helpers';

/**
 * Cross-attraction matching:
 * Only show participants where BOTH sides could be attracted to each other.
 * E.g. if I'm a male attracted_to women, show only females attracted_to men or all.
 */
function matchesCrossAttraction(
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

/** Fetch all visible participants in the grid (with cross-attraction + block filtering). */
export async function getGridParticipants(
  eventId: string,
  myId: string
): Promise<GridParticipant[]> {
  // Fire independent queries in parallel - join photos in the same query
  const [blockedIds, myProfileRes, participantsRes] = await Promise.all([
    getBlockedIds(eventId, myId),
    supabase
      .from('participants')
      .select('gender, attracted_to')
      .eq('id', myId)
      .maybeSingle(),
    supabase
      .from('participants')
      .select('id, event_id, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at, participant_photos(id, event_id, participant_id, storage_path, order_index, created_at)')
      .eq('event_id', eventId)
      .eq('is_banned', false)
      .neq('id', myId)
      .order('order_index', { referencedTable: 'participant_photos' })
      .limit(200),
  ]);

  // If myProfile query failed or participant doesn't exist, return empty
  if (myProfileRes.error) {
    console.error('[getGridParticipants] myProfile error:', myProfileRes.error.message);
    return [];
  }
  if (!myProfileRes.data) return [];

  if (participantsRes.error) {
    console.error('[getGridParticipants] participants error:', participantsRes.error.message);
    return [];
  }

  const myProfile = myProfileRes.data;
  const participants = participantsRes.data;

  if (!participants) return [];

  // Filter out blocked + incomplete profiles (must have name AND age)
  let filtered = participants.filter((p) => !blockedIds.has(p.id));
  filtered = filtered.filter((p) => p.display_name.trim().length > 0 && p.age != null);

  // Apply cross-attraction matching
  if (myProfile) {
    filtered = filtered.filter((p) => matchesCrossAttraction(myProfile, p));
  }

  return filtered.map((p) => {
    const { participant_photos, ...rest } = p as typeof p & { participant_photos: ParticipantPhoto[] };
    return { ...rest, photos: participant_photos || [] };
  }) as GridParticipant[];
}
