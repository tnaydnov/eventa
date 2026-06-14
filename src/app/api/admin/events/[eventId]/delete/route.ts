import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

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
  const denied = await adminGuard(req, 'admin-delete', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  const supabase = getServiceClient();

  try {
    // 1. Collect participant IDs for storage cleanup
    const { data: parts, error: partsErr } = await supabase
      .from('participants')
      .select('id')
      .eq('event_id', eventId);
    if (partsErr) {
      logger.error('[ADMIN_EVENT_DELETE] participants query error:', partsErr.message);
      return jsonError('Failed to query participants', 500);
    }
    const pIds = (parts || []).map((p: { id: string }) => p.id);

    // Helper: delete from a table and log errors (non-fatal for cascade)
    const warnings: string[] = [];
    const purge = async (table: string, filter: { col: string; val: string | string[]; op?: 'eq' | 'in' }) => {
      const query = supabase.from(table).delete();
      const q = filter.op === 'in'
        ? query.in(filter.col, filter.val as string[])
        : query.eq(filter.col, filter.val as string);
      const { error } = await q;
      if (error) {
        logger.error(`[ADMIN_EVENT_DELETE] ${table} delete error:`, error.message);
        warnings.push(`${table}: ${error.message}`);
      }
    };

    // 2. Delete participant photos from storage + DB
    if (pIds.length > 0) {
      const { data: photos } = await supabase
        .from('participant_photos')
        .select('storage_path')
        .in('participant_id', pIds);

      if (photos && photos.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('photos')
          .remove(photos.map((p: { storage_path: string }) => p.storage_path));
        if (storageErr) logger.error('[ADMIN_EVENT_DELETE] photo storage remove error:', storageErr.message);
      }

      await purge('participant_photos', { col: 'participant_id', val: pIds, op: 'in' });
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
        const { error: mediaErr } = await supabase.storage
          .from('photos')
          .remove(chatMedia.map((m: { media_path: string }) => m.media_path));
        if (mediaErr) logger.error('[ADMIN_EVENT_DELETE] chat media storage remove error:', mediaErr.message);
      }

      await purge('messages', { col: 'conversation_id', val: cIds, op: 'in' });
    }
    await purge('conversations', { col: 'event_id', val: eventId });

    // 4. Delete independent tables in parallel (includes ALL event-scoped tables)
    await Promise.all([
      purge('likes', { col: 'event_id', val: eventId }),
      purge('blocks', { col: 'event_id', val: eventId }),
      purge('banned_devices', { col: 'event_id', val: eventId }),
      purge('notifications', { col: 'event_id', val: eventId }),
      purge('activity_log', { col: 'event_id', val: eventId }),
      purge('event_analytics_snapshots', { col: 'event_id', val: eventId }),
      purge('client_portal_tokens', { col: 'event_id', val: eventId }),
      purge('otp_verifications', { col: 'event_id', val: eventId }),
      purge('event_guest_phones', { col: 'event_id', val: eventId }),
      purge('message_log', { col: 'event_id', val: eventId }),
    ]);

    // 5. Delete participants (FK children before parent)
    await purge('participants', { col: 'event_id', val: eventId });

    // 6. Cleanup background images from storage (best-effort)
    const { error: bgErr } = await supabase.storage.from('backgrounds').remove(
      ['jpg', 'png', 'webp'].map(ext => `${eventId}/bg.${ext}`)
    );
    if (bgErr) logger.error('[ADMIN_EVENT_DELETE] background storage remove error:', bgErr.message);

    const { error: eventDelErr } = await supabase.from('events').delete().eq('id', eventId);
    if (eventDelErr) {
      logger.error('[ADMIN_EVENT_DELETE] event delete error:', eventDelErr.message);
      return jsonError('Failed to delete event', 500);
    }

    evictEventStatusCache(eventId);
    adminAuditLog('EVENT_DELETE', { eventId, warnings }, req);
    return NextResponse.json({ success: true, ...(warnings.length > 0 && { warnings }) });
  } catch (err) {
    logger.error('[ADMIN_EVENT_DELETE] error:', err);
    return jsonError('Failed to delete event', 500);
  }
}
