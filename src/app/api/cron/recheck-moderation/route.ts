import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { moderateProfilePhoto } from '@/lib/moderation';

/** Max photos to recheck per run. */
const BATCH_SIZE = 30;

/**
 * GET|POST /api/cron/recheck-moderation
 * Rechecks photos that still have moderation_status='pending' (e.g., after cold start).
 * Auth: Bearer CRON_SECRET (timing-safe).
 * Schedule: Every 15 minutes via vercel.json.
 */
async function handler(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-recheck-moderation:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[RECHECK_MODERATION_CRON] CRON_SECRET not set');
    return jsonError('Server configuration error', 500);
  }
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = getServiceClient();

  // Fetch oldest unmoderated photos
  const { data: photos, error: fetchError } = await supabase
    .from('participant_photos')
    .select('id, storage_path, event_id, participant_id')
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    logger.error('[RECHECK_MODERATION_CRON] fetch error:', fetchError.message);
    return jsonError('Server error', 500);
  }

  if (!photos || photos.length === 0) {
    return NextResponse.json({ processed: 0, message: 'Nothing to recheck' });
  }

  logger.info(`[RECHECK_MODERATION_CRON] Rechecking ${photos.length} photos`);

  let processed = 0;
  for (const photo of photos) {
    if (photo.storage_path) {
      await moderateProfilePhoto(
        photo.id as string,
        photo.storage_path as string,
        photo.participant_id as string | undefined,
        photo.event_id as string | undefined,
      );
      processed++;
    }
  }

  return NextResponse.json({ processed });
}

export const GET = handler;
export const POST = handler;
