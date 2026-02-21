import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient, serviceUpdate } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { adminAuditLog } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/events/[eventId]/archive
 * Archives an event:
 *  1. Fetches analytics snapshot.
 *  2. Saves snapshot to event_analytics_snapshots (upsert).
 *  3. Purges user data (participants, photos, likes, messages, etc.).
 *  4. Sets event status → 'archived', archived_at, is_active → false.
 *
 * This is a destructive operation — use with care.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-archive', RATE_LIMITS.strict);
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
      .single();

    if (eventErr || !event) {
      return jsonError('Event not found', 404);
    }

    if (event.status === 'archived') {
      return jsonError('Event is already archived', 400);
    }

    // ── Step 1: Compute FULL analytics snapshot before purging ──
    // We call the analytics endpoint internally to get the complete EventAnalytics object
    let snapshot: Record<string, unknown>;

    try {
      const analyticsUrl = new URL(`/api/admin/events/${eventId}/analytics`, req.url);
      // Forward admin cookie + cron auth (so cron-initiated archives get full analytics)
      const fwdHeaders: Record<string, string> = {};
      const cookie = req.headers.get('cookie');
      const auth = req.headers.get('authorization');
      if (cookie) fwdHeaders['cookie'] = cookie;
      if (auth) fwdHeaders['authorization'] = auth;
      const analyticsRes = await fetch(analyticsUrl.toString(), {
        headers: fwdHeaders,
      });

      if (analyticsRes.ok) {
        snapshot = await analyticsRes.json();
      } else {
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
        };
      }
    } catch {
      // If internal fetch fails, do basic counts
      const [pCount, lCount, cCount, mCount] = await Promise.all([
        supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);
      snapshot = {
        totalParticipants: pCount.count || 0,
        totalLikes: lCount.count || 0,
        totalConversations: cCount.count || 0,
        totalMessages: mCount.count || 0,
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
    await purge('messages');
    await purge('conversations');
    await purge('blocks');
    await purge('likes');

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
    const { error: updateErr } = await serviceUpdate(
      'events',
      { status: 'archived', is_active: false, archived_at: new Date().toISOString() },
      { id: eventId }
    );

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
