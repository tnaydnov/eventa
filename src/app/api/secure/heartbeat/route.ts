import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';

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

    // Only update last_seen_at if stale (>2 min since last write)
    // This cuts DB writes by ~5× while keeping activity_log accurate
    const { data: current } = await supabase
      .from('participants')
      .select('last_seen_at')
      .eq('id', session.sub)
      .single();

    const now = new Date().toISOString();
    const lastSeen = current?.last_seen_at ? new Date(current.last_seen_at).getTime() : 0;
    const stale = Date.now() - lastSeen > 2 * 60 * 1000; // 2 minutes

    // Always log the heartbeat activity
    await supabase.from('activity_log').insert({
      event_id: session.eid,
      participant_id: session.sub,
      action: 'heartbeat',
    });

    if (stale) {
      await supabase
        .from('participants')
        .update({ last_seen_at: now })
        .eq('id', session.sub);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[HEARTBEAT] error:', err);
    return jsonError('Server error', 500);
  }
}
