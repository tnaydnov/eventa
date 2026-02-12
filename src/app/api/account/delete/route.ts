import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { clearSessionCookieHeader } from '@/lib/session';
import { STORAGE_BATCH_SIZE } from '@/lib/constants';
import { secureGuard, jsonError } from '@/lib/route-helpers';

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated participant and all their associated data.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'account-delete', RATE_LIMITS.strict);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const participantId = session.sub;
    const eventId = session.eid;

    const supabase = getServiceClient();

    // Pre-check: verify participant exists before starting cascade
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .single();

    if (!participant) {
      return jsonError('Participant not found', 404);
    }

    // 1. Delete photos from storage
    const { data: photos } = await supabase
      .from('participant_photos')
      .select('storage_path')
      .eq('participant_id', participantId);

    if (photos && photos.length > 0) {
      await supabase.storage
        .from('photos')
        .remove(photos.map((p) => p.storage_path));
    }

    // 2. Delete photo records
    await supabase
      .from('participant_photos')
      .delete()
      .eq('participant_id', participantId);

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
            console.error('[ACCOUNT_DELETE] media batch error:', batchErr);
          }
        }
      }

      await supabase.from('messages').delete().in('conversation_id', convoIds);
      await supabase.from('conversations').delete().in('id', convoIds);
    }

    // 4-7. Delete likes, blocks, compass locations, notifications, activity_log in parallel
    await Promise.all([
      supabase.from('likes').delete()
        .eq('event_id', eventId)
        .or(`from_participant_id.eq.${participantId},to_participant_id.eq.${participantId}`),
      supabase.from('blocks').delete()
        .eq('event_id', eventId)
        .or(`blocker_id.eq.${participantId},blocked_id.eq.${participantId}`),
      supabase.from('compass_locations').delete()
        .eq('participant_id', participantId),
      supabase.from('notifications').delete()
        .eq('event_id', eventId)
        .eq('to_participant_id', participantId),
      supabase.from('activity_log').delete()
        .eq('event_id', eventId)
        .eq('participant_id', participantId),
    ]);

    // Delete compass sessions after locations (FK dependency)
    await supabase.from('compass_sessions').delete()
      .eq('event_id', eventId)
      .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`);

    // 8. Finally, delete the participant record
    await supabase
      .from('participants')
      .delete()
      .eq('id', participantId);

    console.log('[ACCOUNT_DELETE] success:', JSON.stringify({ participantId, eventId, ts: new Date().toISOString() }));

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (err) {
    console.error('[ACCOUNT_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
