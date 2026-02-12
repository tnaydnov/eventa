import { supabase } from '../supabase';
import { getBlockedIds, buildParticipantPhotoMaps } from './helpers';
import type { MatchEntry } from '../stores/matches';

/**
 * Fetch all mutual-like pairs (matches) for the current user.
 *
 * A match = two rows in `likes` where A→B and B→A both exist.
 * Uses a self-join with the existing indexes on (event_id, from_participant_id)
 * and (event_id, to_participant_id).
 */
export async function getMatches(
  eventId: string,
  myId: string,
): Promise<MatchEntry[]> {
  const blockedIds = await getBlockedIds(eventId, myId);

  // Find all participants where both directions of like exist
  const { data: myLikes } = await supabase
    .from('likes')
    .select('to_participant_id, created_at')
    .eq('event_id', eventId)
    .eq('from_participant_id', myId);

  if (!myLikes || myLikes.length === 0) return [];

  const myLikedIds = myLikes.map((l) => l.to_participant_id);

  // Of those I liked, find who liked me back
  const { data: reciprocal } = await supabase
    .from('likes')
    .select('from_participant_id, created_at')
    .eq('event_id', eventId)
    .eq('to_participant_id', myId)
    .in('from_participant_id', myLikedIds);

  if (!reciprocal || reciprocal.length === 0) return [];

  // Build a map: participantId → latest of the two like timestamps
  const myLikeMap = new Map(myLikes.map((l) => [l.to_participant_id, l.created_at]));
  const matchedIds: { id: string; matchedAt: string }[] = [];

  for (const r of reciprocal) {
    if (blockedIds.has(r.from_participant_id)) continue;
    const myLikeTs = myLikeMap.get(r.from_participant_id)!;
    const theirLikeTs = r.created_at;
    // "matchedAt" = the later of the two likes (the moment the match formed)
    const matchedAt = myLikeTs > theirLikeTs ? myLikeTs : theirLikeTs;
    matchedIds.push({ id: r.from_participant_id, matchedAt });
  }

  if (matchedIds.length === 0) return [];

  const ids = matchedIds.map((m) => m.id);
  const { pMap, phMap } = await buildParticipantPhotoMaps(ids);
  const matchedAtMap = new Map(matchedIds.map((m) => [m.id, m.matchedAt]));

  return matchedIds
    .filter((m) => pMap.has(m.id))
    .sort((a, b) => b.matchedAt.localeCompare(a.matchedAt)) // newest first
    .map((m) => ({
      participantId: m.id,
      participant: { ...pMap.get(m.id)!, photos: phMap.get(m.id) || [] },
      matchedAt: matchedAtMap.get(m.id)!,
    }));
}

