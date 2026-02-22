import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/secure/conversations - Get or create a conversation.
 * Guards: CSRF, auth, rate limit, self-chat, block check.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'conv', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { otherId } = await req.json();
    if (!otherId || !isValidUUID(otherId)) {
      return jsonError('Invalid participant', 400);
    }

    // Prevent self-conversation
    if (otherId === session.sub) {
      return jsonError('Cannot start conversation with yourself', 400);
    }

    const myId = session.sub;
    const eventId = session.eid;
    const supabase = getServiceClient();

    // Block check + existing conversation - fire in parallel
    const [blockResult, existingResult] = await Promise.all([
      supabase
        .from('blocks')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .or(
          `and(blocker_id.eq.${myId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${myId})`
        ),
      supabase
        .from('conversations')
        .select('id, event_id, a_participant_id, b_participant_id, created_at, last_message_at, a_last_read_at, b_last_read_at')
        .eq('event_id', eventId)
        .or(
          `and(a_participant_id.eq.${myId},b_participant_id.eq.${otherId}),and(a_participant_id.eq.${otherId},b_participant_id.eq.${myId})`
        )
        .maybeSingle(),
    ]);

    // Fail closed: if block check errors, refuse the action
    if (blockResult.error) {
      logger.error('[CONVERSATIONS] block check error:', blockResult.error.message);
      return jsonError('Server error', 500);
    }
    if (existingResult.error) {
      logger.error('[CONVERSATIONS] existing conv check error:', existingResult.error.message);
      return jsonError('Server error', 500);
    }

    if ((blockResult.count ?? 0) > 0) {
      return jsonError('Cannot start conversation - user is blocked', 403);
    }

    if (existingResult.data) return NextResponse.json(existingResult.data);

    // Create new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        event_id: eventId,
        a_participant_id: myId,
        b_participant_id: otherId,
      })
      .select()
      .single();

    if (error) {
      logger.error('[CONVERSATIONS] insert error (possible race):', error.message);
      // Race condition: re-fetch
      const { data: refetch } = await supabase
        .from('conversations')
        .select('id, event_id, a_participant_id, b_participant_id, created_at, last_message_at, a_last_read_at, b_last_read_at')
        .eq('event_id', eventId)
        .or(
          `and(a_participant_id.eq.${myId},b_participant_id.eq.${otherId}),and(a_participant_id.eq.${otherId},b_participant_id.eq.${myId})`
        )
        .maybeSingle();

      if (refetch) return NextResponse.json(refetch);
      return jsonError('Failed to create conversation', 500);
    }

    return NextResponse.json(data);
  } catch (err) {
    logger.error('[CONVERSATIONS] error:', err);
    return jsonError('Server error', 500);
  }
}
