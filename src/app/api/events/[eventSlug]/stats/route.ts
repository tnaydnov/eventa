import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/events/[eventSlug]/stats
 * Returns public-facing event statistics for the feedback thank-you screen.
 * No auth required - data is aggregate only, no PII.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`event-stats:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  const { eventSlug } = await params;

  try {
    const supabase = getServiceClient();

    // Find event by slug
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id')
      .eq('slug', eventSlug)
      .maybeSingle();

    if (eventErr) {
      logger.error('[EVENT_STATS] event lookup failed', { error: eventErr.message });
      return jsonError('Server error', 500);
    }
    if (!event) {
      return jsonError('Event not found', 404);
    }

    const eventId = event.id;

    /** Count rows filtered by event_id */
    const countByEvent = (table: string) =>
      supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

    /** Count rows filtered by event_id + optional extra filter */
    const countFiltered = (table: string, extraCol?: string, extraVal?: string) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('event_id', eventId);
      if (extraCol && extraVal) q = q.eq(extraCol, extraVal);
      return q;
    };

    const [participants, women, men, conversations, likes] = await Promise.all([
      countByEvent('participants'),
      countFiltered('participants', 'gender', 'female'),
      countFiltered('participants', 'gender', 'male'),
      countByEvent('conversations'),
      countByEvent('likes'),
    ]);

    const countErrors = [
      participants.error && `participants: ${participants.error.message}`,
      women.error && `women: ${women.error.message}`,
      men.error && `men: ${men.error.message}`,
      conversations.error && `conversations: ${conversations.error.message}`,
      likes.error && `likes: ${likes.error.message}`,
    ].filter(Boolean);

    if (countErrors.length > 0) {
      logger.error('[EVENT_STATS] count errors', { errors: countErrors.join('; ') });
      return jsonError('Failed to load stats', 500);
    }

    return NextResponse.json({
      participants: participants.count ?? 0,
      women: women.count ?? 0,
      men: men.count ?? 0,
      matches: conversations.count ?? 0,
      conversations: conversations.count ?? 0,
      likes: likes.count ?? 0,
    });
  } catch (err) {
    logger.error('[EVENT_STATS] unexpected error', err);
    return jsonError('Server error', 500);
  }
}
