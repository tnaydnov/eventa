import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { sendFeedbackMessage } from '@/lib/messaging';
import type { EventMessagingConfig } from '@/lib/messaging';

/** Maximum participants to message per cron invocation (15s Vercel timeout). */
const MAX_MESSAGES_PER_RUN = 50;

/** Delay between WA API calls (ms). */
const INTER_MESSAGE_DELAY_MS = 100;

/** Hours after event ends to start sending feedback. */
const FEEDBACK_DELAY_HOURS = 8;

/** Hours after event ends after which we stop attempting feedback. */
const FEEDBACK_WINDOW_HOURS = 12;

/**
 * GET|POST /api/cron/feedback-messages
 * Sends WhatsApp feedback/thank-you messages ~8 hours after events end.
 * Uses utility templates (no marketing window required).
 * Auth: Bearer CRON_SECRET (timing-safe).
 * Schedule: Every hour via vercel.json.
 */
async function handler(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-feedback:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[FEEDBACK_CRON] CRON_SECRET not set');
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

    // Window: events that ended between 1 and 6 hours ago
    const windowStart = new Date(
      now.getTime() - FEEDBACK_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();
    const windowEnd = new Date(
      now.getTime() - FEEDBACK_DELAY_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Find ended events in the feedback window
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, name, slug, join_code, wa_messages_enabled')
      .eq('status', 'ended')
      .gte('ends_at', windowStart)
      .lte('ends_at', windowEnd);

    if (eventError) {
      logger.error('[FEEDBACK_CRON] event query failed', {
        error: eventError.message,
      });
      return jsonError('Database error', 500);
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        processed: 0,
        sent: 0,
        skipped: 0,
        message: 'No events in feedback window',
      });
    }

    let totalSent = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;

    for (const event of events) {
      if (totalProcessed >= MAX_MESSAGES_PER_RUN) {
        logger.info('[FEEDBACK_CRON] Hit per-run limit', {
          processed: totalProcessed,
        });
        break;
      }

      // Fetch participants who haven't received feedback yet
      const remaining = MAX_MESSAGES_PER_RUN - totalProcessed;
      const { data: participants, error: pError } = await supabase
        .from('participants')
        .select('id, phone, sms_consent')
        .eq('event_id', event.id)
        .eq('feedback_sent', false)
        .not('phone', 'is', null)
        .eq('sms_consent', true)
        .limit(remaining);

      if (pError) {
        logger.error('[FEEDBACK_CRON] participant query failed', {
          eventId: event.id,
          error: pError.message,
        });
        continue;
      }

      if (!participants || participants.length === 0) {
        continue;
      }

      const config: EventMessagingConfig = {
        eventId: event.id,
        eventName: event.name,
        eventSlug: event.slug,
        joinCode: event.join_code,
        waMessagesEnabled: event.wa_messages_enabled ?? false,
      };

      for (const p of participants) {
        if (!p.phone) continue;

        const result = await sendFeedbackMessage(p.phone, config);

        // Mark feedback_sent = true regardless of outcome (don't retry)
        const { error: updateErr } = await supabase
          .from('participants')
          .update({ feedback_sent: true })
          .eq('id', p.id);
        if (updateErr) logger.error('[CRON_FEEDBACK] Failed to mark feedback_sent', { participantId: p.id, error: updateErr.message });

        if (result.success) {
          totalSent++;
        } else {
          totalSkipped++;
        }

        totalProcessed++;

        if (totalProcessed < MAX_MESSAGES_PER_RUN) {
          await new Promise((resolve) =>
            setTimeout(resolve, INTER_MESSAGE_DELAY_MS)
          );
        }
      }

      logger.info('[FEEDBACK_CRON] Processed event', {
        eventId: event.id,
        eventName: event.name,
        participantsProcessed: participants.length,
      });
    }

    logger.info('[FEEDBACK_CRON] Complete', {
      processed: totalProcessed,
      sent: totalSent,
      skipped: totalSkipped,
    });

    return NextResponse.json({
      processed: totalProcessed,
      sent: totalSent,
      skipped: totalSkipped,
    });
  } catch (err) {
    logger.error('[FEEDBACK_CRON] error', { error: err instanceof Error ? err.message : String(err) });
    return jsonError('Cron execution failed', 500);
  }
}

// Vercel Cron sends GET requests
export { handler as GET, handler as POST };
