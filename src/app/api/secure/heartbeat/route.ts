import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/secure/heartbeat
 * Client sends a heartbeat every ~60 seconds while the app is active.
 * Inserts one 'heartbeat' row into activity_log for usage-timeline analytics.
 * Also updates participant last_seen_at and tab_visible.
 * When tab becomes visible, cancels pending SMS notifications (user is back).
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'heartbeat', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    // Accept optional tab_visible flag from client
    let tabVisible = false;
    try {
      const body = await req.json();
      tabVisible = body?.tab_visible === true;
    } catch {
      // Body is optional — older clients won't send it
    }

    const supabase = getServiceClient();

    // Fire the last_seen_at check and activity_log insert in parallel
    const [participantRes, activityRes] = await Promise.all([
      supabase
        .from('participants')
        .select('last_seen_at, tab_visible')
        .eq('id', session.sub)
        .maybeSingle(),
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
    const tabVisibilityChanged = current?.tab_visible !== tabVisible;

    if (stale || tabVisibilityChanged) {
      const updates: Record<string, unknown> = {};
      if (stale) updates.last_seen_at = now;
      if (tabVisibilityChanged) updates.tab_visible = tabVisible;

      void supabase
        .from('participants')
        .update(updates)
        .eq('id', session.sub)
        .then(({ error }) => { if (error) logger.error('[HEARTBEAT] participant update error:', { error: error.message }); });
    }

    // When tab becomes visible, cancel any pending SMS for this participant
    if (tabVisible && current?.tab_visible === false) {
      void supabase
        .from('pending_sms')
        .update({ cancelled_at: now, cancel_reason: 'user_returned' })
        .eq('recipient_id', session.sub)
        .eq('event_id', session.eid)
        .is('sent_at', null)
        .is('cancelled_at', null)
        .then(({ error }) => {
          if (error) logger.error('[HEARTBEAT] cancel pending sms error:', { error: error.message });
        });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[HEARTBEAT] error:', err);
    return jsonError('Server error', 500);
  }
}

