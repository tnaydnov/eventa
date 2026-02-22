import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/secure/heartbeat
 * Client sends a heartbeat every ~60 seconds while the app is active.
 * Inserts one 'heartbeat' row into activity_log for usage-timeline analytics.
 * Also updates participant last_seen_at.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'heartbeat', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const supabase = getServiceClient();

    // Fire the last_seen_at check and activity_log insert in parallel
    const [participantRes, activityRes] = await Promise.all([
      supabase
        .from('participants')
        .select('last_seen_at')
        .eq('id', session.sub)
        .single(),
      supabase.from('activity_log').insert({
        event_id: session.eid,
        participant_id: session.sub,
        action: 'heartbeat',
      }),
    ]);

    if (participantRes.error) logger.error('[HEARTBEAT] participant query error:', participantRes.error.message);
    if (activityRes.error) logger.error('[HEARTBEAT] activity_log insert error:', activityRes.error.message);

    const current = participantRes.data;

    const now = new Date().toISOString();
    const lastSeen = current?.last_seen_at ? new Date(current.last_seen_at).getTime() : 0;
    const stale = Date.now() - lastSeen > 2 * 60 * 1000; // 2 minutes

    if (stale) {
      // Fire-and-forget - don't wait for the UPDATE to respond
      Promise.resolve(
        supabase
          .from('participants')
          .update({ last_seen_at: now })
          .eq('id', session.sub)
      ).catch((err) => logger.error('[HEARTBEAT] last_seen update error:', err));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[HEARTBEAT] error:', err);
    return jsonError('Server error', 500);
  }
}
