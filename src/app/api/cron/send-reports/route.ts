import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { withCronHeartbeat } from '@/lib/cron-heartbeat';
import { generateReport } from '@/lib/report/generate';
import { sendReportEmail } from '@/lib/report/email';

/**
 * Hours after event ends to generate + send the report.
 * Minimum wait so all activity has wound down.
 */
const REPORT_DELAY_HOURS = 12;

/**
 * Hours after event ends after which we stop attempting (avoid stale reports).
 */
const REPORT_WINDOW_HOURS = 36;

/**
 * GET|POST /api/cron/send-reports
 * For each event that ended 12–36h ago and has no report email sent yet:
 *  1. Generates the report (analytics + AI summary).
 *  2. Sends the report email to the client.
 *  3. Marks email_sent_at on event_reports.
 * Auth: Bearer CRON_SECRET (timing-safe).
 * Schedule: Every hour (0 * * * *) via vercel.json.
 */
async function handler(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-send-reports:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[SEND_REPORTS_CRON] CRON_SECRET not set');
    return jsonError('Server configuration error', 500);
  }
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = getServiceClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - REPORT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() - REPORT_DELAY_HOURS * 60 * 60 * 1000).toISOString();

  // Find events that ended in the window and haven't had a report email sent
  const { data: events, error: fetchError } = await supabase
    .from('events')
    .select('id, name, slug, client_email, client_name, send_report_email, ends_at')
    .gte('ends_at', windowStart)
    .lte('ends_at', windowEnd)
    .eq('send_report_email', true)
    .not('client_email', 'is', null);

  if (fetchError) {
    logger.error('[SEND_REPORTS_CRON] fetch events error:', fetchError.message);
    return jsonError('Server error', 500);
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No events to report on' });
  }

  // Filter out events that already have a sent report
  const eventIds = events.map((e) => e.id);
  const { data: sentReports } = await supabase
    .from('event_reports')
    .select('event_id')
    .in('event_id', eventIds)
    .not('email_sent_at', 'is', null);

  const sentEventIds = new Set((sentReports ?? []).map((r) => r.event_id as string));
  const pendingEvents = events.filter((e) => !sentEventIds.has(e.id as string));

  logger.info(`[SEND_REPORTS_CRON] Processing ${pendingEvents.length} events`);

  let processed = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    try {
      // Generate (or re-use existing) report
      const result = await generateReport(event.id as string);
      if (!result.success || !result.payload) {
        logger.error(`[SEND_REPORTS_CRON] Failed to generate report for ${event.id}`);
        failed++;
        continue;
      }

      // Send the report email. The report is fully self-contained in the attached PDF,
      // so it no longer depends on a client-portal token (the portal is guest-list only).
      const emailSent = await sendReportEmail({
        to: event.client_email as string,
        eventName: event.name as string,
        eventId: event.id as string,
        payload: result.payload,
        aiSummary: result.ai_summary,
        clientName: (event.client_name as string) ?? null,
        eventDate: (event.ends_at as string) ?? null,
      });

      if (emailSent) {
        // Mark email sent
        await supabase
          .from('event_reports')
          .update({ email_sent_at: new Date().toISOString(), email_sent_to: event.client_email })
          .eq('event_id', event.id);
        processed++;
      } else {
        failed++;
      }
    } catch (err) {
      logger.error(`[SEND_REPORTS_CRON] Error processing event ${event.id}:`, err);
      failed++;
    }
  }

  logger.info(`[SEND_REPORTS_CRON] Done: processed=${processed} failed=${failed}`);
  return NextResponse.json({ processed, failed });
}

const cronHandler = withCronHeartbeat('send-reports', handler);
export { cronHandler as GET, cronHandler as POST };
