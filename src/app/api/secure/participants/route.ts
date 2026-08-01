import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { decryptParticipantRow, readPhone } from '@/lib/pii';
import { logger } from '@/lib/logger';

/** Cross-attraction matching (duplicated server-side so grid.ts can be simplified). */
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

/** Columns for display (grid / profile cards) — no phone. */
const DISPLAY_COLS =
  'id, event_id, display_name, gender, attracted_to, bio_enc, age, city, looking_for_enc, is_banned, last_seen_at, created_at';

/** Columns for display including photos join. */
const DISPLAY_COLS_WITH_PHOTOS =
  `${DISPLAY_COLS}, participant_photos(id, event_id, participant_id, storage_path, order_index, created_at, moderation_status)`;

/** Own-profile columns — includes encrypted phone & SMS consent fields. */
const OWN_PROFILE_COLS =
  `${DISPLAY_COLS}, phone_enc, phone_bi, sms_consent, sms_notifications_enabled, feedback_consent, feedback_sent`;

/**
 * GET /api/secure/participants
 *
 * Authenticates via session cookie. Returns decrypted participant data.
 *
 * Query modes (mutually exclusive, checked in this order):
 *   ?me=1          — own profile (all fields incl. phone)
 *   ?id=<uuid>     — single participant by ID (display fields only)
 *   ?ids=id1,id2   — batch of participants by ID (display fields, max 200)
 *   ?eventId=<uuid>— full grid for the session's event (filtered, decrypted)
 */
export async function GET(req: NextRequest) {
  const guard = await secureGuard(req, 'participants-read', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  const url = new URL(req.url);
  const supabase = getServiceClient();

  // ── Own profile ────────────────────────────────────────────────────────────
  if (url.searchParams.has('me')) {
    const [participantRes, photosRes] = await Promise.all([
      supabase.from('participants').select(OWN_PROFILE_COLS).eq('id', session.sub).maybeSingle(),
      supabase.from('participant_photos').select('id, event_id, participant_id, storage_path, order_index, created_at, moderation_status').eq('participant_id', session.sub).order('order_index'),
    ]);
    if (participantRes.error) {
      logger.error('[PARTICIPANTS_GET_ME] query error:', participantRes.error.message);
      return jsonError('Failed to load profile', 500);
    }
    if (!participantRes.data) return jsonError('Participant not found', 404);
    const dec = decryptParticipantRow(participantRes.data);
    return NextResponse.json({ ...dec, phone: readPhone(participantRes.data), photos: photosRes.data || [] });
  }

  // ── Single participant ─────────────────────────────────────────────────────
  const singleId = url.searchParams.get('id');
  if (singleId) {
    const { data, error } = await supabase
      .from('participants')
      .select(DISPLAY_COLS_WITH_PHOTOS)
      .eq('id', singleId)
      .maybeSingle();
    if (error) {
      logger.error('[PARTICIPANTS_GET_ID] query error:', error.message);
      return jsonError('Failed to load participant', 500);
    }
    if (!data) return NextResponse.json(null);
    const { participant_photos, ...rest } = data as Record<string, unknown> & { participant_photos: unknown[] };
    const dec = decryptParticipantRow(rest);
    const visiblePhotos = ((participant_photos as Array<Record<string, unknown>>) || []).filter(
      (ph) => !ph.moderation_status || ph.moderation_status === 'approved'
    );
    return NextResponse.json({ ...dec, photos: visiblePhotos });
  }

  // ── Batch by IDs ──────────────────────────────────────────────────────────
  const idsParam = url.searchParams.get('ids');
  if (idsParam) {
    const idList = idsParam.split(',').filter(Boolean).slice(0, 200);
    if (idList.length === 0) return NextResponse.json([]);
    const { data, error } = await supabase
      .from('participants')
      .select(DISPLAY_COLS)
      .in('id', idList);
    if (error) {
      logger.error('[PARTICIPANTS_GET_IDS] query error:', error.message);
      return jsonError('Failed to load participants', 500);
    }
    return NextResponse.json((data || []).map(decryptParticipantRow));
  }

  // ── Grid for an event ─────────────────────────────────────────────────────
  const eventId = url.searchParams.get('eventId');
  if (eventId) {
    if (session.eid !== eventId) return jsonError('Forbidden', 403);

    // Fetch my profile + blocks + participants in parallel
    const [myProfileRes, blocksARes, blocksBRes, participantsRes] = await Promise.all([
      supabase.from('participants').select('gender, attracted_to').eq('id', session.sub).maybeSingle(),
      supabase.from('blocks').select('blocked_id').eq('event_id', eventId).eq('blocker_id', session.sub),
      supabase.from('blocks').select('blocker_id').eq('event_id', eventId).eq('blocked_id', session.sub),
      supabase
        .from('participants')
        .select(DISPLAY_COLS_WITH_PHOTOS)
        .eq('event_id', eventId)
        .eq('is_banned', false)
        .is('deleted_at', null)
        .neq('id', session.sub)
        .order('order_index', { referencedTable: 'participant_photos' })
        .limit(200),
    ]);

    if (myProfileRes.error) {
      logger.error('[PARTICIPANTS_GRID] myProfile error:', myProfileRes.error.message);
      return jsonError('Service unavailable', 503);
    }
    if (participantsRes.error) {
      logger.error('[PARTICIPANTS_GRID] participants error:', participantsRes.error.message);
      return jsonError('Failed to load participants', 500);
    }

    const blockedIds = new Set([
      ...((blocksARes.data || []).map((b: { blocked_id: string }) => b.blocked_id)),
      ...((blocksBRes.data || []).map((b: { blocker_id: string }) => b.blocker_id)),
    ]);

    const myProfile = myProfileRes.data;
    let filtered = (participantsRes.data || []).filter((p) => !blockedIds.has(p.id as string));
    filtered = filtered.filter((p) => (p.display_name as string)?.trim().length > 0 && p.age != null);
    if (myProfile) {
      filtered = filtered.filter((p) => matchesCrossAttraction(
        myProfile as { gender: string; attracted_to: string },
        p as { gender: string; attracted_to: string }
      ));
    }

    const result = filtered.map((p) => {
      const { participant_photos, ...rest } = p as Record<string, unknown> & { participant_photos: Array<Record<string, unknown>> };
      const dec = decryptParticipantRow(rest);
      const visiblePhotos = (participant_photos || []).filter(
        (ph) => !ph.moderation_status || ph.moderation_status === 'approved'
      );
      return { ...dec, photos: visiblePhotos };
    });

    return NextResponse.json(result);
  }

  return jsonError('Missing query parameter: me, id, ids, or eventId', 400);
}
