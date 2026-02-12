import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';

/**
 * DELETE /api/admin/events/[eventId]/delete
 * Cascade-deletes an entire event and all associated data.
 *
 * Order matters: storage files must be collected before DB rows are removed,
 * and FK-dependent tables must be cleared before their parents.
 * Independent tables (likes, blocks, etc.) are deleted in parallel for speed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-delete', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  const supabase = getServiceClient();

  try {
    // 1. Collect participant IDs for storage cleanup
    const { data: parts } = await supabase
      .from('participants')
      .select('id')
      .eq('event_id', eventId);
    const pIds = (parts || []).map((p: { id: string }) => p.id);

    // 2. Delete participant photos from storage + DB
    if (pIds.length > 0) {
      const { data: photos } = await supabase
        .from('participant_photos')
        .select('storage_path')
        .in('participant_id', pIds);

      if (photos && photos.length > 0) {
        await supabase.storage
          .from('photos')
          .remove(photos.map((p: { storage_path: string }) => p.storage_path));
      }

      await supabase.from('participant_photos').delete().in('participant_id', pIds);
    }

    // 3. Delete chat media from storage, then messages + conversations
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .eq('event_id', eventId);
    const cIds = (convos || []).map((c: { id: string }) => c.id);

    if (cIds.length > 0) {
      const { data: chatMedia } = await supabase
        .from('messages')
        .select('media_path')
        .in('conversation_id', cIds)
        .not('media_path', 'is', null);

      if (chatMedia && chatMedia.length > 0) {
        await supabase.storage
          .from('photos')
          .remove(chatMedia.map((m: { media_path: string }) => m.media_path));
      }

      await supabase.from('messages').delete().in('conversation_id', cIds);
    }
    await supabase.from('conversations').delete().eq('event_id', eventId);

    // 4. Delete independent tables in parallel (+ compass which has its own sub-query)
    const compassCleanup = (async () => {
      const { data: cSess } = await supabase
        .from('compass_sessions')
        .select('id')
        .eq('event_id', eventId);
      const csIds = (cSess || []).map((c: { id: string }) => c.id);
      if (csIds.length > 0) {
        await supabase.from('compass_locations').delete().in('compass_session_id', csIds);
      }
      await supabase.from('compass_sessions').delete().eq('event_id', eventId);
    })();

    await Promise.all([
      supabase.from('likes').delete().eq('event_id', eventId),
      supabase.from('blocks').delete().eq('event_id', eventId),
      supabase.from('banned_devices').delete().eq('event_id', eventId),
      supabase.from('notifications').delete().eq('event_id', eventId),
      supabase.from('activity_log').delete().eq('event_id', eventId),
      supabase.from('event_analytics_snapshots').delete().eq('event_id', eventId),
      compassCleanup,
    ]);

    // 5. Delete participants + the event itself (order: FK children first)
    await supabase.from('participants').delete().eq('event_id', eventId);

    // 6. Cleanup background images from storage (best-effort, before deleting event row)
    await supabase.storage.from('backgrounds').remove(
      ['jpg', 'png', 'webp'].map(ext => `${eventId}/bg.${ext}`)
    );

    await supabase.from('events').delete().eq('id', eventId);

    adminAuditLog('EVENT_DELETE', { eventId }, req);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ADMIN_EVENT_DELETE] error:', err);
    return jsonError('Failed to delete event', 500);
  }
}
