import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { RETENTION_DAYS, STORAGE_BATCH_SIZE } from '@/lib/constants';
import { jsonError } from '@/lib/route-helpers';

/**
 * POST /api/cleanup
 * Deletes all data for events that ended more than RETENTION_DAYS ago.
 * Intended to be called by a cron job (e.g. Vercel Cron).
 *
 * Auth: Bearer ${CRON_SECRET} header, timing-safe comparison via SHA-256.
 */
export async function POST(req: NextRequest) {
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

    // Find events that ended more than RETENTION_DAYS ago
    const { data: oldEvents } = await supabase
      .from('events')
      .select('id')
      .lt('ends_at', cutoff);

    if (!oldEvents || oldEvents.length === 0) {
      return NextResponse.json({ message: 'Nothing to clean up', deleted: 0 });
    }

    const eventIds = oldEvents.map((e) => e.id);

    // Collect storage paths BEFORE deleting DB rows (otherwise we lose the references)
    const [{ data: photos }, { data: chatMedia }] = await Promise.all([
      supabase
        .from('participant_photos')
        .select('storage_path')
        .in('event_id', eventIds),
      supabase
        .from('messages')
        .select('media_path')
        .in('event_id', eventIds)
        .not('media_path', 'is', null),
    ]);

    const photoStoragePaths = (photos || []).map((p) => p.storage_path);
    const chatMediaPaths = (chatMedia || []).filter((m) => m.media_path).map((m) => m.media_path!);

    // Delete storage files BEFORE DB rows (if storage fails, paths are still in DB for retry)
    const allPaths = [...photoStoragePaths, ...chatMediaPaths];
    for (let i = 0; i < allPaths.length; i += STORAGE_BATCH_SIZE) {
      const batch = allPaths.slice(i, i + STORAGE_BATCH_SIZE);
      await supabase.storage.from('photos').remove(batch);
    }

    // Delete background images from storage (best-effort)
    const bgPaths = eventIds.flatMap((id) =>
      ['jpg', 'png', 'webp'].map((ext) => `${id}/bg.${ext}`)
    );
    for (let i = 0; i < bgPaths.length; i += STORAGE_BATCH_SIZE) {
      await supabase.storage.from('backgrounds').remove(bgPaths.slice(i, i + STORAGE_BATCH_SIZE));
    }

    // Cascade-delete DB rows per event (respects FK ordering)
    for (const eventId of eventIds) {
      // Compass: locations → sessions
      const { data: compassSessions } = await supabase
        .from('compass_sessions')
        .select('id')
        .eq('event_id', eventId);
      const csIds = (compassSessions || []).map((cs) => cs.id);
      if (csIds.length > 0) {
        await supabase.from('compass_locations').delete().in('compass_session_id', csIds);
      }
      await supabase.from('compass_sessions').delete().eq('event_id', eventId);

      // Independent tables in parallel
      await Promise.all([
        supabase.from('notifications').delete().eq('event_id', eventId),
        supabase.from('likes').delete().eq('event_id', eventId),
        supabase.from('blocks').delete().eq('event_id', eventId),
        supabase.from('banned_devices').delete().eq('event_id', eventId),
      ]);

      // Messages → conversations (FK order)
      await supabase.from('messages').delete().eq('event_id', eventId);
      await supabase.from('conversations').delete().eq('event_id', eventId);

      // Photos → participants → event (FK order)
      await supabase.from('participant_photos').delete().eq('event_id', eventId);
      await supabase.from('participants').delete().eq('event_id', eventId);
      await supabase.from('events').delete().eq('id', eventId);
    }

    return NextResponse.json({
      message: 'Cleanup complete',
      deletedEvents: eventIds.length,
      deletedFiles: allPaths.length + bgPaths.length,
    });
  } catch (err) {
    console.error('[CLEANUP] error:', err);
    return jsonError('Cleanup failed', 500);
  }
}
