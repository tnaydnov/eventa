import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/secure/blocks - Block a participant.
 *
 * Cascade: inserts block row, removes bidirectional likes,
 * deletes conversation + messages,
 * and clears notifications between the pair.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'block', RATE_LIMITS.strict);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { blockedId } = await req.json();
    if (!blockedId || !isValidUUID(blockedId)) {
      return jsonError('Invalid participant', 400);
    }

    const blockerId = session.sub;
    const eventId = session.eid;

    // Guard: no self-block
    if (blockedId === blockerId) {
      return jsonError('Cannot block yourself', 400);
    }

    const supabase = getServiceClient();

    // Check interaction context BEFORE cascade delete
    const [likeFwdRes, likeRevRes, convoRes] = await Promise.all([
      supabase.from('likes').select('id').eq('event_id', eventId)
        .eq('from_participant_id', blockerId).eq('to_participant_id', blockedId).maybeSingle(),
      supabase.from('likes').select('id').eq('event_id', eventId)
        .eq('from_participant_id', blockedId).eq('to_participant_id', blockerId).maybeSingle(),
      supabase.from('conversations').select('id').eq('event_id', eventId)
        .or(`and(a_participant_id.eq.${blockerId},b_participant_id.eq.${blockedId}),and(a_participant_id.eq.${blockedId},b_participant_id.eq.${blockerId})`)
        .maybeSingle(),
    ]);

    if (likeFwdRes.error) logger.error('[BLOCKS] likeFwd context error:', likeFwdRes.error.message);
    if (likeRevRes.error) logger.error('[BLOCKS] likeRev context error:', likeRevRes.error.message);
    if (convoRes.error) logger.error('[BLOCKS] convo context error:', convoRes.error.message);

    const hadLike = !!(likeFwdRes.data || likeRevRes.data);
    const hadMatch = !!(likeFwdRes.data && likeRevRes.data);
    const hadConversation = !!convoRes.data;

    // Insert block with context
    const { error: blockError } = await supabase
      .from('blocks')
      .insert({
        event_id: eventId,
        blocker_id: blockerId,
        blocked_id: blockedId,
        had_like: hadLike,
        had_conversation: hadConversation,
        had_match: hadMatch,
      });

    if (blockError) {
      // Duplicate block - return success idempotently
      if (blockError.code === '23505') {
        return NextResponse.json({ success: true });
      }
      return jsonError('Failed to block user', 400);
    }

    // Activity log (fire-and-forget)
    void supabase.from('activity_log').insert({
      event_id: eventId,
      participant_id: blockerId,
      action: 'block',
    }).then(({ error }) => { if (error) logger.error('[BLOCKS] activity_log error:', { error: error.message }); });

    // Delete bidirectional likes + notifications (independent - parallelize)
    const [likesDel1, likesDel2, notifDel1, notifDel2] = await Promise.all([
      supabase.from('likes').delete()
        .eq('event_id', eventId)
        .eq('from_participant_id', blockerId)
        .eq('to_participant_id', blockedId),
      supabase.from('likes').delete()
        .eq('event_id', eventId)
        .eq('from_participant_id', blockedId)
        .eq('to_participant_id', blockerId),
      supabase.from('notifications').delete()
        .eq('event_id', eventId)
        .eq('to_participant_id', blockerId)
        .eq('payload->>from_participant_id', blockedId),
      supabase.from('notifications').delete()
        .eq('event_id', eventId)
        .eq('to_participant_id', blockedId)
        .eq('payload->>from_participant_id', blockerId),
    ]);

    if (likesDel1.error) logger.error('[BLOCKS] cascade likes del1:', likesDel1.error.message);
    if (likesDel2.error) logger.error('[BLOCKS] cascade likes del2:', likesDel2.error.message);
    if (notifDel1.error) logger.error('[BLOCKS] cascade notif del1:', notifDel1.error.message);
    if (notifDel2.error) logger.error('[BLOCKS] cascade notif del2:', notifDel2.error.message);

    // Delete conversation + messages (FK order: messages → conversations)
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .eq('event_id', eventId)
      .or(
        `and(a_participant_id.eq.${blockerId},b_participant_id.eq.${blockedId}),and(a_participant_id.eq.${blockedId},b_participant_id.eq.${blockerId})`
      );

    const convoIds = (convos || []).map((c: { id: string }) => c.id);
    if (convoIds.length > 0) {
      // Fetch media paths before deleting messages so we can clean storage
      const { data: mediaMessages } = await supabase
        .from('messages')
        .select('media_path')
        .in('conversation_id', convoIds)
        .not('media_path', 'is', null);

      const { error: msgDelErr } = await supabase.from('messages').delete().in('conversation_id', convoIds);
      if (msgDelErr) logger.error('[BLOCKS] messages delete error:', msgDelErr.message);
      const { error: convDelErr } = await supabase.from('conversations').delete().in('id', convoIds);
      if (convDelErr) logger.error('[BLOCKS] conversations delete error:', convDelErr.message);

      // Clean orphaned media files from storage
      const mediaPaths = (mediaMessages || [])
        .map((m: { media_path: string | null }) => m.media_path)
        .filter((p): p is string => !!p);
      if (mediaPaths.length > 0) {
        const { error: storageErr } = await supabase.storage.from('photos').remove(mediaPaths);
        if (storageErr) logger.error('[BLOCKS] media cleanup failed', { error: storageErr.message });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[BLOCKS] error:', err);
    return jsonError('Server error', 500);
  }
}
