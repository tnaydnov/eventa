import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { computeEventAnalytics } from '@/lib/compute-event-analytics';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/events/[eventId]/analytics
 * Returns deep analytics for a single event.
 * Archived events are served from snapshots; live events are computed on the fly.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-analytics', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    // ── Check if event is archived → serve from snapshot ──
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('status')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr) {
      logger.error('[ADMIN_ANALYTICS] event lookup error:', eventErr.message);
      return jsonError('Failed to fetch event', 500);
    }

    if (!event) {
      return jsonError('Event not found', 404);
    }

    if (event?.status === 'archived') {
      const { data: snap, error: snapErr } = await supabase
        .from('event_analytics_snapshots')
        .select('snapshot')
        .eq('event_id', eventId)
        .maybeSingle();

      if (snapErr) {
        logger.error('[ADMIN_ANALYTICS] snapshot lookup error:', snapErr.message);
        return jsonError('Failed to fetch analytics snapshot', 500);
      }

      if (snap?.snapshot) {
        return NextResponse.json(snap.snapshot);
      }
      return jsonError('No analytics snapshot found for archived event', 404);
    }

    // ── Compute analytics from live data ──
    const analytics = await computeEventAnalytics(supabase, eventId);
    return NextResponse.json(analytics);
  } catch (err) {
    logger.error('[ADMIN_ANALYTICS] error:', err);
    return jsonError('Failed to load analytics', 500);
  }
}
