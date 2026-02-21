import { supabase } from '../supabase';
import type { Like } from '../database.types';
import { getBlockedIds, buildParticipantPhotoMaps, LIKE_COLUMNS } from './helpers';

/** Result of sending a like — includes match detection. */
export interface SendLikeResult extends Like {
  match: boolean;
}

/** Send a like to another participant. Returns the like + match flag. */
export async function sendLike(toId: string): Promise<SendLikeResult | null> {
  try {
    const res = await fetch('/api/secure/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Remove a previously sent like. */
export async function removeLike(toId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/likes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get likes received by the current user (with sender details). */
export async function getReceivedLikes(eventId: string, myId: string) {
  const [blockedIds, likesRes] = await Promise.all([
    getBlockedIds(eventId, myId),
    supabase
      .from('likes')
      .select(LIKE_COLUMNS)
      .eq('event_id', eventId)
      .eq('to_participant_id', myId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (likesRes.error) console.error('[getReceivedLikes] query error:', likesRes.error.message);
  const likes = likesRes.data;
  if (!likes) return [];

  const filtered = likes.filter((l) => !blockedIds.has(l.from_participant_id));
  const fromIds = filtered.map((l) => l.from_participant_id);
  if (fromIds.length === 0) return [];

  const { pMap, phMap } = await buildParticipantPhotoMaps(fromIds);

  return filtered
    .filter((l) => pMap.has(l.from_participant_id))
    .map((l) => ({
      ...l,
      from: { ...pMap.get(l.from_participant_id)!, photos: phMap.get(l.from_participant_id) || [] },
    }));
}

/** Get likes sent by the current user (with recipient details). */
export async function getSentLikes(eventId: string, myId: string) {
  const [blockedIds, likesRes] = await Promise.all([
    getBlockedIds(eventId, myId),
    supabase
      .from('likes')
      .select(LIKE_COLUMNS)
      .eq('event_id', eventId)
      .eq('from_participant_id', myId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (likesRes.error) console.error('[getSentLikes] query error:', likesRes.error.message);
  const likes = likesRes.data;
  if (!likes) return [];

  const filtered = likes.filter((l) => !blockedIds.has(l.to_participant_id));
  const toIds = filtered.map((l) => l.to_participant_id);
  if (toIds.length === 0) return [];

  const { pMap, phMap } = await buildParticipantPhotoMaps(toIds);

  return filtered
    .filter((l) => pMap.has(l.to_participant_id))
    .map((l) => ({
      ...l,
      to: { ...pMap.get(l.to_participant_id)!, photos: phMap.get(l.to_participant_id) || [] },
    }));
}

/**
 * Get IDs of all participants the current user has liked in this event.
 * Lightweight alternative to `getSentLikes` when only IDs are needed.
 */
export async function getSentLikeIds(
  eventId: string,
  myId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('likes')
    .select('to_participant_id')
    .eq('event_id', eventId)
    .eq('from_participant_id', myId);
  return data?.map((l) => l.to_participant_id) ?? [];
}

/** Check whether a like already exists. */
export async function hasLiked(
  eventId: string,
  fromId: string,
  toId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('event_id', eventId)
    .eq('from_participant_id', fromId)
    .eq('to_participant_id', toId)
    .maybeSingle();
  return !!data;
}

/** Mark a single like as seen. */
export async function markLikeSeen(fromParticipantId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/likes/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromParticipantId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Mark ALL received likes as seen. */
export async function markAllLikesSeen(): Promise<boolean> {
  try {
    const res = await fetch('/api/secure/likes/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get IDs of participants whose likes haven't been seen yet. */
export async function getUnseenLikes(
  eventId: string,
  myId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('likes')
    .select('from_participant_id')
    .eq('event_id', eventId)
    .eq('to_participant_id', myId)
    .is('seen_at', null);
  return (data || []).map((l) => l.from_participant_id);
}
