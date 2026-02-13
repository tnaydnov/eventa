import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { sendPushToParticipant } from '@/lib/web-push';

/**
 * POST /api/secure/likes — Send a like.
 * Guards: block check, self-like prevention.
 *
 * DELETE /api/secure/likes — Remove a like.
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

    // Block check — refuse like if either party blocked the other
    const { count: blockCount } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', session.eid)
      .or(
        `and(blocker_id.eq.${session.sub},blocked_id.eq.${toId}),and(blocker_id.eq.${toId},blocked_id.eq.${session.sub})`
      );

    if ((blockCount ?? 0) > 0) {
      return jsonError('Cannot like — user is blocked', 403);
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
          .single();
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

    // Activity log + notification — fire in parallel, don't block the response
    Promise.all([
      supabase.from('activity_log').insert({
        event_id: session.eid,
        participant_id: session.sub,
        action: 'like',
      }),
      supabase.from('notifications').insert({
        event_id: session.eid,
        to_participant_id: toId,
        type: 'like_received',
        payload: { from_participant_id: session.sub, match: isMatch },
        is_read: false,
      }),
    ]).catch(() => {}); // fire-and-forget

    // Web Push (fire-and-forget)
    Promise.all([
      supabase.from('participants').select('display_name').eq('id', session.sub).single(),
      supabase.from('events').select('slug').eq('id', session.eid).single(),
    ]).then(([{ data: sender }, { data: event }]) => {
        const name = sender?.display_name || 'מישהו';
        const slug = event?.slug || '';
        sendPushToParticipant(toId, {
          title: isMatch ? '🎉 יש לכם התאמה!' : '💖 לייק חדש!',
          body: isMatch ? `${name} גם שלח/ה לכם לייק — יש התאמה!` : `${name} שלח/ה לכם לייק`,
          url: slug ? `/dating/${slug}` : '/dating',
          tag: isMatch ? `match-${session.sub}` : `like-${session.sub}`,
        });
      }).catch(() => {});

    return NextResponse.json({ ...data, match: isMatch });
  } catch (err) {
    console.error('[LIKES_POST] error:', err);
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
    await Promise.all([
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[LIKES_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
