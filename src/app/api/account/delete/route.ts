import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { clearSessionCookieHeader } from '@/lib/session';
import { STORAGE_BATCH_SIZE } from '@/lib/constants';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated participant and all their associated data.
 */
export async function POST(req: NextRequest) {
  logger.info('[ACCOUNT_DELETE] request received');
  const guard = await secureGuard(req, 'account-delete', RATE_LIMITS.strict);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const participantId = session.sub;
    const eventId = session.eid;

    const supabase = getServiceClient();

    // Pre-check: verify participant exists before starting cascade
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .eq('event_id', eventId)
      .single();

    if (participantError || !participant) {
      return jsonError('Participant not found', 404);
    }

    // 1. Delete photos from storage (scoped to event)
    const { data: photos } = await supabase
      .from('participant_photos')
      .select('storage_path')
      .eq('participant_id', participantId)
      .eq('event_id', eventId);

    if (photos && photos.length > 0) {
      await supabase.storage
        .from('photos')
        .remove(photos.map((p) => p.storage_path));
    }

    // 2. Delete photo records (scoped to event)
    await supabase
      .from('participant_photos')
      .delete()
      .eq('participant_id', participantId)
      .eq('event_id', eventId);

    // 3. Delete messages (from conversations involving this user)
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .eq('event_id', eventId)
      .or(`a_participant_id.eq.${participantId},b_participant_id.eq.${participantId}`);

    const convoIds = (convos || []).map((c) => c.id);
    if (convoIds.length > 0) {
      // Delete chat media from storage before deleting messages
      const { data: chatMedia } = await supabase
        .from('messages')
        .select('media_path')
        .in('conversation_id', convoIds)
        .not('media_path', 'is', null);

      const mediaPaths = (chatMedia || [])
        .filter((m) => m.media_path)
        .map((m) => m.media_path!);

      if (mediaPaths.length > 0) {
        for (let i = 0; i < mediaPaths.length; i += STORAGE_BATCH_SIZE) {
          try {
            await supabase.storage.from('photos').remove(mediaPaths.slice(i, i + STORAGE_BATCH_SIZE));
          } catch (batchErr) {
            logger.error('[ACCOUNT_DELETE] media batch error:', batchErr);
          }
        }
      }

      const { error: msgsDelErr } = await supabase.from('messages').delete().in('conversation_id', convoIds);
      if (msgsDelErr) logger.error('[ACCOUNT_DELETE] messages delete error:', msgsDelErr.message);

      const { error: convosDelErr } = await supabase.from('conversations').delete().in('id', convoIds);
      if (convosDelErr) logger.error('[ACCOUNT_DELETE] conversations delete error:', convosDelErr.message);
    }

    // 4-6. Delete likes, blocks, notifications, activity_log in parallel
    const [likesRes, blocksRes, notifsRes, activityRes] = await Promise.all([
      supabase.from('likes').delete()
        .eq('event_id', eventId)
        .or(`from_participant_id.eq.${participantId},to_participant_id.eq.${participantId}`),
      supabase.from('blocks').delete()
        .eq('event_id', eventId)
        .or(`blocker_id.eq.${participantId},blocked_id.eq.${participantId}`),
      supabase.from('notifications').delete()
        .eq('event_id', eventId)
        .eq('to_participant_id', participantId),
      supabase.from('activity_log').delete()
        .eq('event_id', eventId)
        .eq('participant_id', participantId),
    ]);

    if (likesRes.error) logger.error('[ACCOUNT_DELETE] likes delete error:', likesRes.error.message);
    if (blocksRes.error) logger.error('[ACCOUNT_DELETE] blocks delete error:', blocksRes.error.message);
    if (notifsRes.error) logger.error('[ACCOUNT_DELETE] notifications delete error:', notifsRes.error.message);
    if (activityRes.error) logger.error('[ACCOUNT_DELETE] activity_log delete error:', activityRes.error.message);

    // 7. Remove device from banned_devices so the user can rejoin freely.
    //    Self-deletion is NOT an admin ban - the user should get a clean slate.
    const { data: selfParticipant } = await supabase
      .from('participants')
      .select('device_fingerprint, hardware_fingerprint')
      .eq('id', participantId)
      .maybeSingle();

    if (selfParticipant) {
      const fps = [
        selfParticipant.device_fingerprint,
        selfParticipant.hardware_fingerprint,
      ].filter(Boolean) as string[];

      for (const fp of fps) {
        await supabase
          .from('banned_devices')
          .delete()
          .eq('event_id', eventId)
          .eq('device_fingerprint', fp);
      }
    }

    // 8. Finally, delete the participant record (critical - must succeed)
    const { error: participantDelErr } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId);

    if (participantDelErr) {
      logger.error('[ACCOUNT_DELETE] participant delete error:', participantDelErr.message);
      return jsonError('Failed to delete account', 500);
    }

    logger.info('[ACCOUNT_DELETE] success:', JSON.stringify({ participantId, eventId, ts: new Date().toISOString() }));

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (err) {
    logger.error('[ACCOUNT_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
