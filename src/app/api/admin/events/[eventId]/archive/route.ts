import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { adminAuditLog } from '@/lib/admin-auth';
import { computeEventAnalytics } from '@/lib/compute-event-analytics';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/events/[eventId]/archive
 * Archives an event:
 *  1. Fetches analytics snapshot.
 *  2. Saves snapshot to event_analytics_snapshots (upsert).
 *  3. Purges user data (participants, photos, likes, messages, etc.).
 *  4. Sets event status → 'archived', archived_at, is_active → false.
 *
 * This is a destructive operation - use with care.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = await adminGuard(req, 'admin-archive', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    // Verify event exists and isn't already archived
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, status, name')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return jsonError('Event not found', 404);
    }

    if (event.status === 'archived') {
      return jsonError('Event is already archived', 400);
    }

    // ── Step 1: Compute FULL analytics snapshot before purging ──
    let snapshot: Record<string, unknown>;

    try {
      const analytics = await computeEventAnalytics(supabase, eventId);
      snapshot = analytics as unknown as Record<string, unknown>;
    } catch (err) {
      logger.error('[ARCHIVE] full analytics computation failed, falling back to basic counts:', err);
      // Fallback to basic counts if full analytics fails
      const [pCount, lCount, cCount, mCount, bCount] = await Promise.all([
        supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('blocks').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);
      snapshot = {
        totalParticipants: pCount.count || 0,
        totalLikes: lCount.count || 0,
        totalConversations: cCount.count || 0,
        totalMessages: mCount.count || 0,
        totalBlocks: bCount.count || 0,
        _partial: true,
      };
    }

    // Add archive timestamp
    (snapshot as Record<string, unknown>).archivedAt = new Date().toISOString();

    // ── Step 2: Save snapshot (upsert) ──
    const { error: snapErr } = await supabase
      .from('event_analytics_snapshots')
      .upsert(
        { event_id: eventId, snapshot },
        { onConflict: 'event_id' }
      );

    if (snapErr) {
      logger.error('[ARCHIVE] snapshot upsert error:', snapErr.message);
      return jsonError('Failed to save analytics snapshot', 500);
    }

    // ── Step 3: Purge user data (cascade-safe order) ──
    // Delete in dependency order: leaf tables first
    const purgeWarnings: string[] = [];
    const purge = async (table: string) => {
      const { error: err } = await supabase.from(table).delete().eq('event_id', eventId);
      if (err) {
        logger.error(`[ARCHIVE] purge ${table} error:`, err.message);
        purgeWarnings.push(table);
      }
    };

    await purge('notifications');
    await purge('activity_log');

    // Clean up chat media files from storage before deleting message rows
    const { data: mediaRows, error: mediaQueryErr } = await supabase
      .from('messages')
      .select('media_path')
      .eq('event_id', eventId)
      .not('media_path', 'is', null);

    if (mediaQueryErr) {
      logger.error('[ARCHIVE] chat media query error:', mediaQueryErr.message);
      purgeWarnings.push('chat_media_query');
    } else if (mediaRows && mediaRows.length > 0) {
      const mediaPaths = mediaRows.map((m: { media_path: string }) => m.media_path);
      const { error: storageErr } = await supabase.storage.from('photos').remove(mediaPaths);
      if (storageErr) {
        logger.error('[ARCHIVE] chat media storage cleanup error:', storageErr.message);
        purgeWarnings.push('chat_media_storage');
      }
    }

    await purge('messages');
    await purge('conversations');
    await purge('blocks');
    await purge('likes');
    await purge('client_portal_tokens');
    await purge('otp_verifications');
    await purge('event_guest_phones');
    await purge('message_log');

    // Delete participant photos from storage
    const { data: photoRows, error: photoQueryErr } = await supabase
      .from('participant_photos')
      .select('storage_path')
      .eq('event_id', eventId);

    if (photoQueryErr) {
      logger.error('[ARCHIVE] photo query error:', photoQueryErr.message);
      purgeWarnings.push('participant_photos_query');
    }

    if (photoRows && photoRows.length > 0) {
      const paths = photoRows.map((p: { storage_path: string }) => p.storage_path);
      await supabase.storage.from('photos').remove(paths);
    }

    await purge('participant_photos');
    await purge('banned_devices');
    await purge('participants');

    // ── Step 4: Mark event as archived ──
    const { error: updateErr } = await supabase
      .from('events')
      .update({
        status: 'archived',
        is_active: false,
        archived_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (updateErr) {
      logger.error('[ARCHIVE] event update error:', updateErr.message);
      return jsonError('Failed to archive event', 500);
    }

    evictEventStatusCache(eventId);
    adminAuditLog('EVENT_ARCHIVE', { eventId, eventName: event.name, snapshot }, req);

    return NextResponse.json({
      success: true,
      snapshot,
      ...(purgeWarnings.length > 0 && { warnings: purgeWarnings }),
    });
  } catch (err) {
    logger.error('[ARCHIVE] error:', err);
    return jsonError('Archive failed', 500);
  }
}
