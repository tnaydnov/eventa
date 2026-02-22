import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/event-status?slug=<eventSlug>
 * Lightweight, no-auth check of event status by slug.
 * Used by join page to detect ended/paused/archived events BEFORE
 * forcing users to accept terms.
 *
 * Returns: { status: 'active'|'ended'|'paused'|'archived'|'not_found' }
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`event-status:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return NextResponse.json({ status: 'rate_limited' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug || slug.length > 100) {
    return NextResponse.json({ status: 'not_found' }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    const { data: event, error } = await supabase
      .from('events')
      .select('status, is_active')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      logger.error('[EVENT_STATUS] lookup error:', error.message);
      return NextResponse.json({ status: 'error' }, { status: 500 });
    }

    if (!event) {
      return NextResponse.json({ status: 'not_found' });
    }

    // Return the raw status — let the client decide how to handle it
    return NextResponse.json({
      status: event.status as string,
      isActive: event.is_active as boolean,
    });
  } catch (err) {
    logger.error('[EVENT_STATUS] unexpected error:', err);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
