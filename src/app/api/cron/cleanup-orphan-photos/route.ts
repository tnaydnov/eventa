import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { verifyCronAuth, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { withCronHeartbeat } from '@/lib/cron-heartbeat';
import { alertCronFailure } from '@/lib/security-alert';

/**
 * GET /api/cron/cleanup-orphan-photos
 *
 * Deletes files from Supabase Storage `photos` bucket that have no corresponding
 * row in `participant_photos`. These are created when a client:
 *  - uploads a file but crashes before calling /api/secure/photos to register it
 *  - has the registration request rejected (magic bytes, moderation, etc.)
 *
 * Grace period: only deletes files older than 2 hours to avoid deleting
 * in-flight uploads that haven't been registered yet.
 *
 * Auth: CRON_SECRET (same as all other cron endpoints).
 * Schedule: every 6 hours (runs 4× per day, low priority).
 */
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours
const BATCH_LIMIT = 200; // max storage items to inspect per run

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = getServiceClient();
  const now = Date.now();
  let deletedCount = 0;
  let errorCount = 0;

  try {
    // List ALL items in the photos bucket (Supabase Storage list is paginated).
    // We iterate top-level "directories" (event IDs) to avoid one huge list call.
    const { data: topLevel, error: topErr } = await supabase.storage
      .from('photos')
      .list('', { limit: BATCH_LIMIT });

    if (topErr) {
      logger.error('[ORPHAN_CLEANUP] top-level list failed', { error: topErr.message });
      alertCronFailure('cleanup-orphan-photos', topErr.message);
      return jsonError('Storage list failed', 500);
    }

    for (const folder of topLevel ?? []) {
      // Top-level entries are event-ID folders (or stray files)
      if (!folder.name) continue;

      // List participant folders inside this event folder
      const { data: participants } = await supabase.storage
        .from('photos')
        .list(folder.name, { limit: BATCH_LIMIT });

      for (const participantFolder of participants ?? []) {
        if (!participantFolder.name) continue;
        const prefix = `${folder.name}/${participantFolder.name}`;

        // List files in this participant's folder
        const { data: files } = await supabase.storage
          .from('photos')
          .list(prefix, { limit: BATCH_LIMIT });

        for (const file of files ?? []) {
          if (!file.name || file.metadata?.mimetype === 'application/x-directory') continue;

          const storagePath = `${prefix}/${file.name}`;

          // Skip files that are too recent (still might be in-flight)
          const createdAt = file.created_at ? new Date(file.created_at).getTime() : 0;
          if (now - createdAt < GRACE_PERIOD_MS) continue;

          // Check if this storage path has a DB record
          const { data: dbRow } = await supabase
            .from('participant_photos')
            .select('id')
            .eq('storage_path', storagePath)
            .maybeSingle();

          if (!dbRow) {
            // Orphan — delete from storage
            const { error: delErr } = await supabase.storage
              .from('photos')
              .remove([storagePath]);

            if (delErr) {
              logger.warn('[ORPHAN_CLEANUP] delete failed', { storagePath, error: delErr.message });
              errorCount++;
            } else {
              logger.info('[ORPHAN_CLEANUP] deleted orphan', { storagePath });
              deletedCount++;
            }
          }
        }
      }
    }

    logger.info('[ORPHAN_CLEANUP] complete', { deletedCount, errorCount });
    return NextResponse.json({ deletedCount, errorCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[ORPHAN_CLEANUP] unexpected error', { error: message });
    alertCronFailure('cleanup-orphan-photos', message);
    return jsonError('Internal error', 500);
  }
}

export const GET = withCronHeartbeat('cleanup-orphan-photos', handler);
export const POST = withCronHeartbeat('cleanup-orphan-photos', handler);
