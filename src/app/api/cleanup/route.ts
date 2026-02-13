import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { RETENTION_DAYS, STORAGE_BATCH_SIZE } from '@/lib/constants';
import { jsonError } from '@/lib/route-helpers';

/**
 * GET|POST /api/cleanup
 * Archives and purges data for events that ended more than RETENTION_DAYS ago.
 *
 * For each qualifying event (not yet archived):
 *  1. Saves a full analytics snapshot to event_analytics_snapshots (permanent).
 *  2. Deletes storage files (photos, chat media, backgrounds).
 *  3. Cascade-deletes all user data from DB.
 *  4. Marks the event as 'archived' (event row + snapshot kept forever).
 *
 * Events already archived are skipped — their data was purged during archival.
 * The event row and analytics snapshot are NEVER deleted by this route.
 *
 * Intended to run after auto-archive (cron safety net for any missed events).
 * Auth: Bearer ${CRON_SECRET} header, timing-safe comparison via SHA-256.
 */
async function handler(req: NextRequest) {
  // Rate-limit even cron-authenticated requests (defense-in-depth)
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cleanup:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256 (avoids length leak)
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CLEANUP] CRON_SECRET environment variable is not set');
    return jsonError('Server configuration error', 500);
  }
  const expected = `Bearer ${cronSecret}`;
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const supabase = getServiceClient();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find events past retention that are NOT yet archived
    const { data: oldEvents } = await supabase
      .from('events')
      .select('id, name')
      .lt('ends_at', cutoff)
      .neq('status', 'archived');

    if (!oldEvents || oldEvents.length === 0) {
      return NextResponse.json({ message: 'Nothing to clean up', archived: 0 });
    }

    let archivedCount = 0;
    let totalDeletedFiles = 0;

    for (const event of oldEvents) {
      const eventId = event.id;

      // ── Step 1: Save analytics snapshot (if none exists yet) ──
      const { data: existingSnap } = await supabase
        .from('event_analytics_snapshots')
        .select('event_id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (!existingSnap) {
        // Try to get full analytics via the analytics API (forwarding cron auth)
        let snapshot: Record<string, unknown> | null = null;

        try {
          const analyticsUrl = new URL(
            `/api/admin/events/${eventId}/analytics`,
            req.url
          );
          const res = await fetch(analyticsUrl.toString(), {
            headers: { authorization: authHeader },
          });
          if (res.ok) {
            snapshot = await res.json();
          }
        } catch {
          /* fallback below */
        }

        // Fallback: compute basic counts directly
        if (!snapshot) {
          const [pCount, lCount, cCount, mCount, bCount, csCount, phCount] =
            await Promise.all([
              supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('messages').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('blocks').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('compass_sessions').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('participant_photos').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
            ]);
          snapshot = {
            totalParticipants: pCount.count || 0,
            totalLikes: lCount.count || 0,
            totalConversations: cCount.count || 0,
            totalMessages: mCount.count || 0,
            totalBlocks: bCount.count || 0,
            compassRequestsSent: csCount.count || 0,
            totalPhotosUploaded: phCount.count || 0,
            _partial: true, // flag: this is a basic fallback, not full analytics
          };
        }

        (snapshot as Record<string, unknown>).archivedAt = new Date().toISOString();

        const { error: snapErr } = await supabase
          .from('event_analytics_snapshots')
          .upsert({ event_id: eventId, snapshot }, { onConflict: 'event_id' });

        if (snapErr) {
          console.error(`[CLEANUP] snapshot error for ${eventId}:`, snapErr.message);
          // Continue anyway — don't block data purge for snapshot failure
        }
      }

      // ── Step 2: Delete storage files ──
      const FETCH_LIMIT = 100_000;
      const [{ data: photos }, { data: chatMedia }] = await Promise.all([
        supabase
          .from('participant_photos')
          .select('storage_path')
          .eq('event_id', eventId)
          .limit(FETCH_LIMIT),
        supabase
          .from('messages')
          .select('media_path')
          .eq('event_id', eventId)
          .not('media_path', 'is', null)
          .limit(FETCH_LIMIT),
      ]);

      const photoPaths = (photos || []).map((p) => p.storage_path);
      const mediaPaths = (chatMedia || [])
        .filter((m) => m.media_path)
        .map((m) => m.media_path!);
      const allPaths = [...photoPaths, ...mediaPaths];

      for (let i = 0; i < allPaths.length; i += STORAGE_BATCH_SIZE) {
        await supabase.storage
          .from('photos')
          .remove(allPaths.slice(i, i + STORAGE_BATCH_SIZE));
      }

      // Background images (best-effort)
      const bgPaths = ['jpg', 'png', 'webp'].map(
        (ext) => `${eventId}/bg.${ext}`
      );
      await supabase.storage.from('backgrounds').remove(bgPaths);

      totalDeletedFiles += allPaths.length + bgPaths.length;

      // ── Step 3: Cascade-delete user data (FK order) ──
      // Compass: locations → sessions
      const { data: compassSessions } = await supabase
        .from('compass_sessions')
        .select('id')
        .eq('event_id', eventId);
      const csIds = (compassSessions || []).map((cs) => cs.id);
      if (csIds.length > 0) {
        await supabase
          .from('compass_locations')
          .delete()
          .in('compass_session_id', csIds);
      }
      await supabase
        .from('compass_sessions')
        .delete()
        .eq('event_id', eventId);

      // Independent tables in parallel
      await Promise.all([
        supabase.from('notifications').delete().eq('event_id', eventId),
        supabase.from('likes').delete().eq('event_id', eventId),
        supabase.from('blocks').delete().eq('event_id', eventId),
        supabase.from('banned_devices').delete().eq('event_id', eventId),
        supabase.from('activity_log').delete().eq('event_id', eventId),
        // NOTE: event_analytics_snapshots is NEVER deleted — kept permanently
      ]);

      // Messages → conversations (FK order)
      await supabase.from('messages').delete().eq('event_id', eventId);
      await supabase.from('conversations').delete().eq('event_id', eventId);

      // Photos → participants (FK order)
      await supabase
        .from('participant_photos')
        .delete()
        .eq('event_id', eventId);
      await supabase.from('participants').delete().eq('event_id', eventId);

      // ── Step 4: Mark event as archived (preserve the row forever) ──
      await supabase
        .from('events')
        .update({
          status: 'archived',
          is_active: false,
          archived_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      archivedCount++;
      console.log(`[CLEANUP] Archived event "${event.name}" (${eventId})`);
    }

    return NextResponse.json({
      message: 'Cleanup complete',
      archivedEvents: archivedCount,
      deletedFiles: totalDeletedFiles,
    });
  } catch (err) {
    console.error('[CLEANUP] error:', err);
    return jsonError('Cleanup failed', 500);
  }
}

// Vercel Cron sends GET requests — expose both methods
export { handler as GET, handler as POST };
