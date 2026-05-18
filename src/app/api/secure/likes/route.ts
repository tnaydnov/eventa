import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { enqueueLikeNotification, enqueueMatchNotification } from '@/lib/notification-dispatcher';

/**
 * POST /api/secure/likes - Send a like.
 * Guards: block check, self-like prevention.
 *
 * DELETE /api/secure/likes - Remove a like.
 * Also removes the associated like_received notification.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'likes-post', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { toId } = await req.json();
    if (!toId || !isValidUUID(toId)) {
      return jsonError('Invalid participant', 400);
    }

    // Prevent self-like
    if (toId === session.sub) {
      return jsonError('Cannot like yourself', 400);
    }

    const supabase = getServiceClient();

    // Block check - refuse like if either party blocked the other
    const { count: blockCount, error: blockError } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', session.eid)
      .or(
        `and(blocker_id.eq.${session.sub},blocked_id.eq.${toId}),and(blocker_id.eq.${toId},blocked_id.eq.${session.sub})`
      );

    // Fail closed: if block check errors, refuse the action
    if (blockError) {
      logger.error('[LIKES_POST] block check error:', blockError.message);
      return jsonError('Server error', 500);
    }

    if ((blockCount ?? 0) > 0) {
      return jsonError('Cannot like - user is blocked', 403);
    }

    const { data, error } = await supabase
      .from('likes')
      .insert({
        event_id: session.eid,
        from_participant_id: session.sub,
        to_participant_id: toId,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (duplicate like) gracefully
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('likes')
          .select('id, event_id, from_participant_id, to_participant_id, created_at, seen_at')
          .eq('event_id', session.eid)
          .eq('from_participant_id', session.sub)
          .eq('to_participant_id', toId)
          .maybeSingle();
        if (existing) {
          // Still check for match on duplicate
          const { data: reciprocal } = await supabase
            .from('likes')
            .select('id')
            .eq('event_id', session.eid)
            .eq('from_participant_id', toId)
            .eq('to_participant_id', session.sub)
            .maybeSingle();
          return NextResponse.json({ ...existing, match: !!reciprocal });
        }
      }
      return jsonError('Failed to create like', 400);
    }

    // Check for reciprocal like → match
    const { data: reciprocal } = await supabase
      .from('likes')
      .select('id')
      .eq('event_id', session.eid)
      .eq('from_participant_id', toId)
      .eq('to_participant_id', session.sub)
      .maybeSingle();

    const isMatch = !!reciprocal;

    // Activity log + notification - fire in parallel, don't block the response
    void Promise.all([
      supabase.from('activity_log').insert({
        event_id: session.eid,
        participant_id: session.sub,
        action: 'like',
      }),
      // Sending a like means the user is engaged; cancel pending inactivity nudges.
      supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'user_engaged' })
        .eq('recipient_id', session.sub)
        .eq('event_id', session.eid)
        .eq('message_type', 'inactivity')
        .is('sent_at', null)
        .is('cancelled_at', null),
      supabase.from('notifications').insert({
        event_id: session.eid,
        to_participant_id: toId,
        type: 'like_received',
        payload: { from_participant_id: session.sub, match: isMatch },
        is_read: false,
      }),
    ]).then(([activityRes, inactivityCancelRes, notifRes]) => {
      if (activityRes.error) logger.error('[LIKES_POST] activity_log error:', { error: activityRes.error.message });
      if (inactivityCancelRes.error) logger.error('[LIKES_POST] inactivity cancel error:', { error: inactivityCancelRes.error.message });
      if (notifRes.error) logger.error('[LIKES_POST] notification error:', { error: notifRes.error.message });
    });

    // Fire event bus events (fire-and-forget)
    eventBus.emit('like_sent', { event_id: session.eid, from_id: session.sub, to_id: toId });
    // Record like_sent funnel step (fire-and-forget)
    void supabase
      .from('funnel_events')
      .insert({ event_id: session.eid, session_id: session.sub, step: 'like_sent', metadata: {} })
      .then(({ error }) => {
        if (error && error.code !== '23505') logger.error('[LIKES_POST] funnel insert error:', error.message);
      });
    if (isMatch) {
      // We don't have the conversation_id yet — check for existing conversation
      void (async () => {
        const supabase2 = getServiceClient();
        const { data: conv } = await supabase2
          .from('conversations')
          .select('id')
          .eq('event_id', session.eid)
          .or(`and(a_participant_id.eq.${session.sub},b_participant_id.eq.${toId}),and(a_participant_id.eq.${toId},b_participant_id.eq.${session.sub})`)
          .maybeSingle();
        if (conv) {
          eventBus.emit('match_created', {
            event_id: session.eid,
            participant_a: session.sub,
            participant_b: toId,
            conversation_id: conv.id as string,
          });
          // Record match_created funnel step for both participants
          void supabase2
            .from('funnel_events')
            .insert([
              { event_id: session.eid, session_id: session.sub, step: 'match_created', metadata: {} },
              { event_id: session.eid, session_id: toId, step: 'match_created', metadata: {} },
            ])
            .then(({ error }) => {
              if (error && error.code !== '23505') logger.error('[LIKES_POST] match funnel insert error:', error.message);
            });
        }
        // SMS notifications (fire-and-forget)
        void enqueueLikeNotification(toId, session.eid);
        if (isMatch) {
          void enqueueMatchNotification(session.sub, toId, session.eid);
        }
      })();
    } else {
      // Just a like, notify recipient
      void enqueueLikeNotification(toId, session.eid);
    }

    return NextResponse.json({ ...data, match: isMatch });
  } catch (err) {
    logger.error('[LIKES_POST] error:', err);
    return jsonError('Server error', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await secureGuard(req, 'likes-del', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { toId } = await req.json();
    if (!toId || !isValidUUID(toId)) {
      return jsonError('Invalid participant', 400);
    }

    const supabase = getServiceClient();

    // Delete like + associated notification in parallel
    const [likeDelRes, notifDelRes] = await Promise.all([
      supabase
        .from('likes')
        .delete()
        .eq('event_id', session.eid)
        .eq('from_participant_id', session.sub)
        .eq('to_participant_id', toId),
      supabase
        .from('notifications')
        .delete()
        .eq('event_id', session.eid)
        .eq('to_participant_id', toId)
        .eq('type', 'like_received')
        .eq('payload->>from_participant_id', session.sub),
    ]);

    if (likeDelRes.error) {
      logger.error('[LIKES_DELETE] like delete error:', likeDelRes.error.message);
      return jsonError('Failed to remove like', 500);
    }
    if (notifDelRes.error) logger.error('[LIKES_DELETE] notif delete error:', notifDelRes.error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[LIKES_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
