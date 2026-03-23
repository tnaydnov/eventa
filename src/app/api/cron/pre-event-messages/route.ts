import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { sendPreEventMessage } from '@/lib/messaging';
import type { EventMessagingConfig } from '@/lib/messaging';

/** Maximum guests to message per cron invocation (15s Vercel timeout). */
const MAX_MESSAGES_PER_RUN = 50;

/** Delay between SMS API calls to avoid provider rate limits (ms). */
const INTER_MESSAGE_DELAY_MS = 100;

/** How many hours before event start to begin sending. */
const PRE_EVENT_WINDOW_HOURS = 3;

/**
 * GET|POST /api/cron/pre-event-messages
 * Sends SMS pre-event reminders 2-3 hours before event start.
 * Auth: Bearer CRON_SECRET (timing-safe).
 * Schedule: Every hour via vercel.json.
 */
async function handler(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-pre-event:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[PRE_EVENT_CRON] CRON_SECRET not set');
    return jsonError('Server configuration error', 500);
  }
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto
    .createHash('sha256')
    .update(`Bearer ${cronSecret}`)
    .digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + PRE_EVENT_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Find events starting within the next N hours that have messaging enabled
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, name, slug, join_code, starts_at, wa_messages_enabled')
      .eq('wa_messages_enabled', true)
      .eq('status', 'active')
      .eq('is_active', true)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', windowEnd);

    if (eventError) {
      logger.error('[PRE_EVENT_CRON] event query failed', {
        error: eventError.message,
      });
      return jsonError('Database error', 500);
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        processed: 0,
        sent: 0,
        failed: 0,
        message: 'No events in pre-event window',
      });
    }

    let totalSent = 0;
    let totalFailed = 0;
    let totalProcessed = 0;

    for (const event of events) {
      // Check if we've hit the per-run limit
      if (totalProcessed >= MAX_MESSAGES_PER_RUN) {
        logger.info('[PRE_EVENT_CRON] Hit per-run limit, remaining will process next run', {
          processed: totalProcessed,
        });
        break;
      }

      // Fetch unsent guest phones for this event
      const remaining = MAX_MESSAGES_PER_RUN - totalProcessed;
      const { data: guests, error: guestError } = await supabase
        .from('event_guest_phones')
        .select('id, phone, guest_name')
        .eq('event_id', event.id)
        .eq('wa_pre_event_sent', false)
        .limit(remaining);

      if (guestError) {
        logger.error('[PRE_EVENT_CRON] guest query failed', {
          eventId: event.id,
          error: guestError.message,
        });
        continue;
      }

      if (!guests || guests.length === 0) {
        continue;
      }

      const config: EventMessagingConfig = {
        eventId: event.id,
        eventName: event.name,
        eventSlug: event.slug,
        joinCode: event.join_code,
        messagesEnabled: true,
      };

      for (const guest of guests) {
        const result = await sendPreEventMessage(
          guest.phone,
          config
        );

        if (result.success) {
          // Mark as sent
          const { error: updateErr } = await supabase
            .from('event_guest_phones')
            .update({
              wa_pre_event_sent: true,
              wa_pre_event_sent_at: new Date().toISOString(),
            })
            .eq('id', guest.id);
          if (updateErr) logger.error('[PRE_EVENT_CRON] Failed to mark wa_pre_event_sent', { guestId: guest.id, error: updateErr.message });
          totalSent++;
        } else {
          totalFailed++;
        }

        totalProcessed++;

        // Delay between messages to avoid provider rate limits
        if (totalProcessed < MAX_MESSAGES_PER_RUN) {
          await new Promise((resolve) =>
            setTimeout(resolve, INTER_MESSAGE_DELAY_MS)
          );
        }
      }

      logger.info('[PRE_EVENT_CRON] Processed event', {
        eventId: event.id,
        eventName: event.name,
        guestsProcessed: guests.length,
      });
    }

    logger.info('[PRE_EVENT_CRON] Complete', {
      processed: totalProcessed,
      sent: totalSent,
      failed: totalFailed,
    });

    return NextResponse.json({
      processed: totalProcessed,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (err) {
    logger.error('[PRE_EVENT_CRON] error', { error: err instanceof Error ? err.message : String(err) });
    return jsonError('Cron execution failed', 500);
  }
}

// Vercel Cron sends GET requests
export { handler as GET, handler as POST };
