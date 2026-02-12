import { supabase } from '../supabase';
import type { Participant, ParticipantPhoto } from '../database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Build the public URL for a participant photo. */
export function getPhotoUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${storagePath}`;
}

/**
 * Fetch the set of participant IDs blocked by / blocking a user.
 * Shared across grid, likes, and conversations queries.
 */
export async function getBlockedIds(eventId: string, myId: string): Promise<Set<string>> {
  const { data: blocks } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .eq('event_id', eventId)
    .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);

  const ids = new Set<string>();
  (blocks || []).forEach((b) => {
    ids.add(b.blocker_id);
    ids.add(b.blocked_id);
  });
  ids.delete(myId);
  return ids;
}

/**
 * Build participant + photo lookup maps for a list of participant IDs.
 * Returns { pMap, phMap } for joining participant data with photos.
 */
/** Explicit columns for participant queries (avoids SELECT *). */
export const PARTICIPANT_COLUMNS = 'id, event_id, device_fingerprint, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at' as const;
export const PHOTO_COLUMNS = 'id, event_id, participant_id, storage_path, order_index, created_at' as const;
export const CONVERSATION_COLUMNS = 'id, event_id, a_participant_id, b_participant_id, created_at, last_message_at, a_last_read_at, b_last_read_at' as const;
export const MESSAGE_COLUMNS = 'id, event_id, conversation_id, sender_participant_id, type, text, media_path, is_deleted, created_at' as const;
export const LIKE_COLUMNS = 'id, event_id, from_participant_id, to_participant_id, created_at, seen_at' as const;

export async function buildParticipantPhotoMaps(ids: string[]) {
  const { data: participants } = await supabase
    .from('participants')
    .select(PARTICIPANT_COLUMNS)
    .in('id', ids);

  const { data: photos } = await supabase
    .from('participant_photos')
    .select(PHOTO_COLUMNS)
    .in('participant_id', ids)
    .order('order_index');

  const pMap = new Map<string, Participant>();
  (participants || []).forEach((p) => pMap.set(p.id, p));

  const phMap = new Map<string, ParticipantPhoto[]>();
  (photos || []).forEach((ph) => {
    if (!phMap.has(ph.participant_id)) phMap.set(ph.participant_id, []);
    phMap.get(ph.participant_id)!.push(ph);
  });

  return { pMap, phMap };
}
