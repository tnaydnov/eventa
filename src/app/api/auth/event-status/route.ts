import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
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
  const rl = await checkRateLimitAsync(`event-status:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return NextResponse.json({ status: 'rate_limited' }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug || slug.length > 100) {
    return NextResponse.json({ status: 'not_found' }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Use .select() without .maybeSingle() because slug recycling
    // (migration 013) allows multiple events to share a slug when
    // one is archived. Prefer the non-archived event if it exists.
    const { data: events, error } = await supabase
      .from('events')
      .select('id, status, is_active')
      .eq('slug', slug);

    if (error) {
      logger.error('[EVENT_STATUS] lookup error:', error.message);
      return NextResponse.json({ status: 'error' }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ status: 'not_found' });
    }

    // If multiple events share this slug, prefer the non-archived one
    const active = events.find((e: { status: string }) => e.status !== 'archived');
    const event = active || events[0];

    // Fire-and-forget funnel event: join_page_view (requires event_id in select)
    if ((event as { id?: string }).id) {
      const eventId = (event as { id: string }).id;
      const fromQr = req.nextUrl.searchParams.get('from_qr') === '1';

      const funnelInserts = [
        supabase.from('funnel_events').insert({
          event_id: eventId,
          step: 'join_page_view',
          metadata: {},
        }),
      ];

      if (fromQr) {
        funnelInserts.push(
          supabase.from('funnel_events').insert({
            event_id: eventId,
            step: 'qr_scan',
            metadata: {},
          })
        );
      }

      void Promise.all(funnelInserts).then((results) => {
        results.forEach(({ error }) => {
          if (error) logger.error('[EVENT_STATUS] funnel insert error', { error: error.message });
        });
      });
    }

    return NextResponse.json({
      status: event.status as string,
      isActive: event.is_active as boolean,
    });
  } catch (err) {
    logger.error('[EVENT_STATUS] unexpected error:', err);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
