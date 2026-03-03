import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { APP_BASE_URL, MSG_TIMING } from '@/lib/config';
import {
  buildClientUploadReminder7DayEmail,
  buildClientUploadReminder3DayEmail,
} from '@/lib/email-templates';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** Template download URL (static asset). */
const TEMPLATE_URL = `${APP_BASE_URL}/templates/guest-upload-template.xlsx`;

/**
 * Determine which reminder type (if any) should be sent based on days until event.
 * Returns the message_type key or null if no reminder is due.
 */
function getReminderType(daysUntilEvent: number): 'upload_reminder_7d' | 'upload_reminder_3d' | null {
  // Use ±0.5 day tolerance for daily cron scheduling
  for (const d of MSG_TIMING.UPLOAD_REMINDER_DAYS) {
    if (Math.abs(daysUntilEvent - d) < 0.5) {
      return d === 7 ? 'upload_reminder_7d' : 'upload_reminder_3d';
    }
  }
  return null;
}

/**
 * GET|POST /api/cron/upload-reminders
 * Sends email reminders to clients who haven't uploaded guest phone lists.
 * Checks at T-7 and T-3 days before event.
 * Auth: Bearer CRON_SECRET (timing-safe).
 * Schedule: Daily at 07:00 UTC (10:00 Israel) via vercel.json.
 */
async function handler(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-upload-reminders:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[UPLOAD_REMINDERS] CRON_SECRET not set');
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

    // Find events with messaging enabled but no guest list uploaded
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, name, slug, starts_at')
      .eq('wa_messages_enabled', true)
      .eq('guest_list_uploaded', false)
      .in('status', ['active', 'draft'])
      .gt('starts_at', now.toISOString());

    if (eventError) {
      logger.error('[UPLOAD_REMINDERS] event query failed', {
        error: eventError.message,
      });
      return jsonError('Database error', 500);
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        processed: 0,
        sent: 0,
        skipped: 0,
        message: 'No events need upload reminders',
      });
    }

    let totalSent = 0;
    let totalSkipped = 0;

    for (const event of events) {
      const daysUntilEvent =
        (new Date(event.starts_at).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24);

      const reminderType = getReminderType(daysUntilEvent);
      if (!reminderType) {
        totalSkipped++;
        continue;
      }

      // Check if this reminder was already sent (via message_log)
      const { data: existingLog } = await supabase
        .from('message_log')
        .select('id')
        .eq('event_id', event.id)
        .eq('message_type', reminderType)
        .eq('channel', 'email')
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        totalSkipped++;
        continue;
      }

      // Look up the original event request for contact info
      const { data: request } = await supabase
        .from('event_requests')
        .select('contact_name, contact_email')
        .eq('approved_event_id', event.id)
        .maybeSingle();

      if (!request?.contact_email) {
        logger.warn('[UPLOAD_REMINDERS] No contact email for event', {
          eventId: event.id,
          eventName: event.name,
        });
        totalSkipped++;
        continue;
      }

      // Get portal token for upload URL
      const { data: portalToken } = await supabase
        .from('client_portal_tokens')
        .select('token')
        .eq('event_id', event.id)
        .eq('is_active', true)
        .maybeSingle();

      const uploadUrl = portalToken
        ? `${APP_BASE_URL}/guest-upload/${event.slug}?k=${portalToken.token}`
        : `${APP_BASE_URL}/guest-upload/${event.slug}`;

      // Compute schedule times for template
      const startsMs = new Date(event.starts_at).getTime();
      const preEventMs = MSG_TIMING.PRE_EVENT_HOURS_BEFORE * 60 * 60 * 1000;
      const messageSendAt = new Date(startsMs - preEventMs).toISOString();
      const uploadDeadline = messageSendAt;

      // Build email based on reminder type
      const email =
        reminderType === 'upload_reminder_7d'
          ? buildClientUploadReminder7DayEmail({
              contactName: request.contact_name,
              eventName: event.name,
              daysLeft: Math.round(daysUntilEvent),
              uploadUrl,
              messageSendAt,
              uploadDeadline,
            })
          : buildClientUploadReminder3DayEmail({
              contactName: request.contact_name,
              eventName: event.name,
              uploadUrl,
              messageSendAt,
              uploadDeadline,
            });

      try {
        await transporter.sendMail({
          from: `"Eventa" <${process.env.SMTP_USER}>`,
          to: request.contact_email,
          subject: email.subject,
          html: email.html,
        });

        // Log to message_log
        await supabase.from('message_log').insert({
          event_id: event.id,
          phone: null,
          channel: 'email',
          message_type: reminderType,
          status: 'sent',
          recipient_email: request.contact_email,
        });

        totalSent++;
        logger.info('[UPLOAD_REMINDERS] Sent reminder', {
          eventId: event.id,
          eventName: event.name,
          type: reminderType,
          to: request.contact_email,
        });
      } catch (emailErr) {
        logger.error('[UPLOAD_REMINDERS] Failed to send email', {
          eventId: event.id,
          error: emailErr,
        });

        // Log failure to message_log
        await supabase.from('message_log').insert({
          event_id: event.id,
          phone: null,
          channel: 'email',
          message_type: reminderType,
          status: 'failed',
          recipient_email: request.contact_email,
          error_message:
            emailErr instanceof Error
              ? emailErr.message.slice(0, 500)
              : 'Unknown error',
        });

        totalSkipped++;
      }
    }

    logger.info('[UPLOAD_REMINDERS] Complete', {
      processed: events.length,
      sent: totalSent,
      skipped: totalSkipped,
    });

    return NextResponse.json({
      processed: events.length,
      sent: totalSent,
      skipped: totalSkipped,
    });
  } catch (err) {
    logger.error('[UPLOAD_REMINDERS] error', { error: err });
    return jsonError('Cron execution failed', 500);
  }
}

// Vercel Cron sends GET requests - expose both methods
export { handler as GET, handler as POST };
