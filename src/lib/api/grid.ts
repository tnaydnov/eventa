import { supabase } from '../supabase';
import type { ParticipantPhoto } from '../database.types';
import type { GridParticipant } from '../store';
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
  // Fire independent queries in parallel
  const [blockedIds, { data: myProfile }, { data: participants }] = await Promise.all([
    getBlockedIds(eventId, myId),
    supabase
      .from('participants')
      .select('gender, attracted_to')
      .eq('id', myId)
      .single(),
    supabase
      .from('participants')
      .select('id, event_id, device_fingerprint, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at')
      .eq('event_id', eventId)
      .eq('is_banned', false)
      .neq('id', myId)
      .limit(200),
  ]);

  if (!participants) return [];

  // Filter out blocked + incomplete profiles
  let filtered = participants.filter((p) => !blockedIds.has(p.id));
  filtered = filtered.filter((p) => p.display_name.trim().length > 0);

  // Apply cross-attraction matching
  if (myProfile) {
    filtered = filtered.filter((p) => matchesCrossAttraction(myProfile, p));
  }

  const ids = filtered.map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: photos } = await supabase
    .from('participant_photos')
    .select('id, event_id, participant_id, storage_path, order_index, created_at')
    .in('participant_id', ids)
    .order('order_index');

  const photoMap = new Map<string, ParticipantPhoto[]>();
  (photos || []).forEach((ph) => {
    if (!photoMap.has(ph.participant_id)) photoMap.set(ph.participant_id, []);
    photoMap.get(ph.participant_id)!.push(ph);
  });

  return filtered.map((p) => ({
    ...p,
    photos: photoMap.get(p.id) || [],
  }));
}
