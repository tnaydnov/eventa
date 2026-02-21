import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { RETENTION_DAYS, STORAGE_BATCH_SIZE } from '@/lib/constants';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

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
    logger.error('[CLEANUP] CRON_SECRET environment variable is not set');
    return jsonError('Server configuration error', 500);
  }
  const expected = `Bearer ${cronSecret}`;
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  // Dry-run mode: log what would be cleaned up without actually deleting
  const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true';

  try {
    const supabase = getServiceClient();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find events past retention that are NOT yet archived
    const { data: oldEvents, error: eventsError } = await supabase
      .from('events')
      .select('id, name')
      .lt('ends_at', cutoff)
      .neq('status', 'archived');

    if (eventsError) {
      logger.error('[CLEANUP] Failed to fetch events:', eventsError);
      return jsonError('Database error', 500);
    }

    if (!oldEvents || oldEvents.length === 0) {
      logger.info('[CLEANUP] No events to clean up', { dryRun });
      return NextResponse.json({ message: 'Nothing to clean up', archived: 0, dryRun });
    }

    if (dryRun) {
      const names = oldEvents.map((e) => e.name);
      logger.info('[CLEANUP] DRY RUN — would archive', { count: oldEvents.length, events: names });
      return NextResponse.json({
        message: 'Dry run — no changes made',
        dryRun: true,
        wouldArchive: oldEvents.length,
        events: names,
      });
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
          const [pCount, lCount, cCount, mCount, bCount, phCount] =
            await Promise.all([
              supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('messages').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('blocks').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
              supabase.from('participant_photos').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
            ]);
          snapshot = {
            totalParticipants: pCount.count || 0,
            totalLikes: lCount.count || 0,
            totalConversations: cCount.count || 0,
            totalMessages: mCount.count || 0,
            totalBlocks: bCount.count || 0,
            totalPhotosUploaded: phCount.count || 0,
            _partial: true, // flag: this is a basic fallback, not full analytics
          };
        }

        (snapshot as Record<string, unknown>).archivedAt = new Date().toISOString();

        const { error: snapErr } = await supabase
          .from('event_analytics_snapshots')
          .upsert({ event_id: eventId, snapshot }, { onConflict: 'event_id' });

        if (snapErr) {
          logger.error(`[CLEANUP] snapshot error for ${eventId}:`, snapErr.message);
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
      // Independent tables in parallel
      const [notifsRes, likesRes, blocksRes, bannedRes, activityRes] = await Promise.all([
        supabase.from('notifications').delete().eq('event_id', eventId),
        supabase.from('likes').delete().eq('event_id', eventId),
        supabase.from('blocks').delete().eq('event_id', eventId),
        supabase.from('banned_devices').delete().eq('event_id', eventId),
        supabase.from('activity_log').delete().eq('event_id', eventId),
        // NOTE: event_analytics_snapshots is NEVER deleted — kept permanently
      ]);

      if (notifsRes.error) logger.error(`[CLEANUP] notifications delete error for ${eventId}:`, notifsRes.error.message);
      if (likesRes.error) logger.error(`[CLEANUP] likes delete error for ${eventId}:`, likesRes.error.message);
      if (blocksRes.error) logger.error(`[CLEANUP] blocks delete error for ${eventId}:`, blocksRes.error.message);
      if (bannedRes.error) logger.error(`[CLEANUP] banned_devices delete error for ${eventId}:`, bannedRes.error.message);
      if (activityRes.error) logger.error(`[CLEANUP] activity_log delete error for ${eventId}:`, activityRes.error.message);

      // Messages → conversations (FK order)
      const { error: msgsErr } = await supabase.from('messages').delete().eq('event_id', eventId);
      if (msgsErr) logger.error(`[CLEANUP] messages delete error for ${eventId}:`, msgsErr.message);

      const { error: convosErr } = await supabase.from('conversations').delete().eq('event_id', eventId);
      if (convosErr) logger.error(`[CLEANUP] conversations delete error for ${eventId}:`, convosErr.message);

      // Photos → participants (FK order)
      const { error: photosErr } = await supabase
        .from('participant_photos')
        .delete()
        .eq('event_id', eventId);
      if (photosErr) logger.error(`[CLEANUP] photos delete error for ${eventId}:`, photosErr.message);

      const { error: participantsErr } = await supabase.from('participants').delete().eq('event_id', eventId);
      if (participantsErr) logger.error(`[CLEANUP] participants delete error for ${eventId}:`, participantsErr.message);

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
      logger.info(`[CLEANUP] Archived event "${event.name}" (${eventId})`);
    }

    logger.info('[CLEANUP] complete', {
      archivedEvents: archivedCount,
      deletedFiles: totalDeletedFiles,
    });

    return NextResponse.json({
      message: 'Cleanup complete',
      archivedEvents: archivedCount,
      deletedFiles: totalDeletedFiles,
    });
  } catch (err) {
    logger.error('[CLEANUP] error:', err);
    return jsonError('Cleanup failed', 500);
  }
}

// Vercel Cron sends GET requests — expose both methods
export { handler as GET, handler as POST };
