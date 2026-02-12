import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';

/**
 * POST /api/secure/conversations — Get or create a conversation.
 * Guards: CSRF, auth, rate limit, self-chat, block check.
 */
export async function POST(req: NextRequest) {
  const guard = secureGuard(req, 'conv', RATE_LIMITS.standard);
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

    // Block check — refuse conversation if either party blocked the other
    const { count: blockCount } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .or(
        `and(blocker_id.eq.${myId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${myId})`
      );

    if ((blockCount ?? 0) > 0) {
      return jsonError('Cannot start conversation — user is blocked', 403);
    }

    // Check existing
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, event_id, a_participant_id, b_participant_id, created_at, last_message_at, a_last_read_at, b_last_read_at')
      .eq('event_id', eventId)
      .or(
        `and(a_participant_id.eq.${myId},b_participant_id.eq.${otherId}),and(a_participant_id.eq.${otherId},b_participant_id.eq.${myId})`
      )
      .maybeSingle();

    if (existing) return NextResponse.json(existing);

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
      console.error('[CONVERSATIONS] insert error (possible race):', error.message);
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
    console.error('[CONVERSATIONS] error:', err);
    return jsonError('Server error', 500);
  }
}
