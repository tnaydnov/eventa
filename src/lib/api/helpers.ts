import { supabase } from '../supabase';
import type { PublicParticipant, ParticipantPhoto } from '../database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Build the public URL for a participant photo. */
export function getPhotoUrl(storagePath: string): string {
  if (!SUPABASE_URL) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not set - photo URLs will be broken');
    return '';
  }
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${storagePath}`;
}

/* ── Cached getBlockedIds ────────────────────────────────────
 * The same blocked-IDs set is requested 5-6× during a single page load
 * (grid, likes-received, likes-sent, matches, conversations…).
 * Cache for 30 s to eliminate redundant DB round-trips.
 */
const _blockedCache = new Map<string, { ids: Set<string>; ts: number }>();
const BLOCKED_TTL = 30_000; // 30 seconds

export async function getBlockedIds(eventId: string, myId: string): Promise<Set<string>> {
  const key = `${eventId}:${myId}`;
  const cached = _blockedCache.get(key);
  if (cached && Date.now() - cached.ts < BLOCKED_TTL) return cached.ids;

  const { data: blocks, error } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .eq('event_id', eventId)
    .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);

  if (error) {
    // SAFETY: never return an empty set on failure - blocked users would become visible.
    // Throw so callers (grid, likes, matches, conversations) surface the error.
    throw new Error(`Failed to fetch blocked IDs: ${error.message}`);
  }

  const ids = new Set<string>();
  (blocks || []).forEach((b) => {
    ids.add(b.blocker_id);
    ids.add(b.blocked_id);
  });
  ids.delete(myId);
  _blockedCache.set(key, { ids, ts: Date.now() });
  return ids;
}

/** Invalidate the blocked-IDs cache (call after blocking/unblocking). */
export function invalidateBlockedCache() {
  _blockedCache.clear();
}

/**
 * Build participant + photo lookup maps for a list of participant IDs.
 * Returns { pMap, phMap } for joining participant data with photos.
 * Batches .in() calls to avoid exceeding PostgREST URL length limits (~50 UUIDs per batch).
 */
/** Explicit columns for participant queries (avoids SELECT *). Excludes fingerprints - those are internal only. */
export const PARTICIPANT_COLUMNS = 'id, event_id, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at' as const;
export const PHOTO_COLUMNS = 'id, event_id, participant_id, storage_path, order_index, created_at' as const;
export const CONVERSATION_COLUMNS = 'id, event_id, a_participant_id, b_participant_id, created_at, last_message_at, a_last_read_at, b_last_read_at' as const;
export const MESSAGE_COLUMNS = 'id, event_id, conversation_id, sender_participant_id, type, text, media_path, is_deleted, created_at' as const;
export const LIKE_COLUMNS = 'id, event_id, from_participant_id, to_participant_id, created_at, seen_at' as const;

export async function buildParticipantPhotoMaps(ids: string[]) {
  const BATCH_SIZE = 50;
  const allParticipants: PublicParticipant[] = [];
  const allPhotos: ParticipantPhoto[] = [];

  if (ids.length === 0) return { pMap: new Map<string, PublicParticipant>(), phMap: new Map<string, ParticipantPhoto[]>() };

  // Launch ALL batches in parallel instead of sequentially
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      Promise.all([
        supabase.from('participants').select(PARTICIPANT_COLUMNS).in('id', batch),
        supabase.from('participant_photos').select(PHOTO_COLUMNS).in('participant_id', batch).order('order_index'),
      ])
    )
  );

  for (const [participantsRes, photosRes] of results) {
    if (participantsRes.error) {
      console.error('[buildParticipantPhotoMaps] participants query error:', participantsRes.error.message);
    }
    if (photosRes.error) {
      console.error('[buildParticipantPhotoMaps] photos query error:', photosRes.error.message);
    }
    if (participantsRes.data) allParticipants.push(...participantsRes.data);
    if (photosRes.data) allPhotos.push(...photosRes.data);
  }

  const pMap = new Map<string, PublicParticipant>();
  allParticipants.forEach((p) => pMap.set(p.id, p));

  const phMap = new Map<string, ParticipantPhoto[]>();
  allPhotos.forEach((ph) => {
    if (!phMap.has(ph.participant_id)) phMap.set(ph.participant_id, []);
    phMap.get(ph.participant_id)!.push(ph);
  });

  return { pMap, phMap };
}
