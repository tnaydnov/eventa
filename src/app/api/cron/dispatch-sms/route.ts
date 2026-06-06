import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { sendSms } from '@/lib/messaging/sms-provider';

/** Maximum SMS messages to dispatch per cron invocation (fits in 15s Vercel timeout). */
const BATCH_SIZE = 50;

/** Delay between SMS API calls (ms). */
const INTER_SMS_DELAY_MS = 100;
const MAX_SMS_ATTEMPTS = 3;
const QUIET_HOUR_START_MINUTES = 22 * 60 + 30; // 22:30
const QUIET_HOUR_END_MINUTES = 8 * 60 + 30; // 08:30
const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

/** Participant is considered online if tab is explicitly visible AND heartbeat is fresh (< 90s). */
function isParticipantOnline(lastSeenAt: string | null, tabVisible: boolean): boolean {
  if (!tabVisible) return false;
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 90_000;
}
function getIsraelMinutesOfDay(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISRAEL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isQuietHoursInIsrael(now: Date): boolean {
  const minutes = getIsraelMinutesOfDay(now);
  return minutes >= QUIET_HOUR_START_MINUTES || minutes < QUIET_HOUR_END_MINUTES;
}

function nextAllowedDispatchTime(now: Date): Date {
  // Convert to Israel wall-clock time via timezone-adjusted proxy date.
  const israelNow = new Date(now.toLocaleString('en-US', { timeZone: ISRAEL_TIMEZONE }));
  const offsetMs = israelNow.getTime() - now.getTime();

  const targetIsrael = new Date(israelNow);
  targetIsrael.setHours(8, 30, 0, 0);
  if (israelNow >= targetIsrael) {
    targetIsrael.setDate(targetIsrael.getDate() + 1);
  }

  return new Date(targetIsrael.getTime() - offsetMs);
}

function isEventActiveNow(startsAt: string, endsAt: string, now: Date): boolean {
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  const nowMs = now.getTime();
  return Number.isFinite(startMs) && Number.isFinite(endMs) && nowMs >= startMs && nowMs <= endMs;
}

async function logReliabilityMetric(params: {
  eventId: string;
  type: 'sms_delivery_success' | 'sms_delivery_failed';
  messageType: string;
  reason?: string;
}) {
  try {
    const supabase = getServiceClient();
    await supabase.from('event_reliability_metrics').insert({
      event_id: params.eventId,
      metric_type: params.type,
      source: 'unknown',
      value: 1,
      metadata: {
        messageType: params.messageType,
        ...(params.reason ? { reason: params.reason } : {}),
      },
    });
  } catch (err) {
    logger.error('[DISPATCH_SMS_CRON] reliability metric insert failed', err);
  }
}

async function recordSmsAttemptFailure(params: {
  smsId: string;
  currentAttempts: number;
  reason: string;
}) {
  const supabase = getServiceClient();
  const nextAttempts = params.currentAttempts + 1;
  const shouldCancel = nextAttempts >= MAX_SMS_ATTEMPTS;

  await supabase
    .from('pending_sms')
    .update({
      attempts: nextAttempts,
      ...(shouldCancel
        ? {
            cancelled_at: new Date().toISOString(),
            cancel_reason: `max_attempts:${params.reason}`,
          }
        : {}),
    })
    .eq('id', params.smsId);
}

/**
 * GET|POST /api/cron/dispatch-sms
 * Processes the pending_sms queue - dispatches up to BATCH_SIZE messages per run.
 * Auth: Bearer CRON_SECRET (timing-safe).
 * Schedule: Every minute (* * * * *) via vercel.json.
 */
async function handler(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`cron-dispatch-sms:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  // Auth: timing-safe comparison via SHA-256
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[DISPATCH_SMS_CRON] CRON_SECRET not set');
    return jsonError('Server configuration error', 500);
  }
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  if (!crypto.timingSafeEqual(authHash, expectedHash)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // Fetch pending messages that are due (scheduled_at <= now), not sent, not cancelled
  const { data: pendingMessages, error: fetchError } = await supabase
    .from('pending_sms')
    .select('id, event_id, recipient_id, phone, message_type, body, attempts')
    .is('sent_at', null)
    .is('cancelled_at', null)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    logger.error('[DISPATCH_SMS_CRON] fetch error:', fetchError.message);
    return jsonError('Server error', 500);
  }

  if (!pendingMessages || pendingMessages.length === 0) {
    return NextResponse.json({ dispatched: 0, message: 'Nothing to send' });
  }

  logger.info(`[DISPATCH_SMS_CRON] Processing ${pendingMessages.length} messages`);

  let dispatched = 0;
  let failed = 0;
  const eventCache = new Map<string, { starts_at: string; ends_at: string; sms_notifications_enabled: boolean }>();

  for (const sms of pendingMessages) {
    // Double-check the recipient hasn't opted out (race condition safety)
    const { data: optout } = await supabase
      .from('sms_optout')
      .select('id')
      .eq('phone', sms.phone)
      .limit(1);

    if (optout && optout.length > 0) {
      // Cancel it silently
      await supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'opted_out' })
        .eq('id', sms.id);
      continue;
    }

    // Re-check participant eligibility at dispatch time to avoid stale notifications.
    const { data: participant } = await supabase
      .from('participants')
      .select('last_seen_at, tab_visible, sms_consent, sms_notifications_enabled')
      .eq('id', sms.recipient_id)
      .maybeSingle();

    if (!participant) {
      await supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'recipient_missing' })
        .eq('id', sms.id);
      continue;
    }

    if (!participant.sms_consent || !participant.sms_notifications_enabled) {
      await supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'sms_disabled' })
        .eq('id', sms.id);
      continue;
    }

    // For match SMS: always dispatch - never cancel based on presence.
    // Match is high-value, deduplicated at enqueue time, and presence detection
    // is unreliable enough on iOS that we risk missing it. One match SMS per match.
    // For all other types: use the standard online check.
    const isUserOnlineForType = sms.message_type === 'match'
      ? false  // never cancel match SMS at dispatch time
      : isParticipantOnline(participant.last_seen_at as string | null, !!participant.tab_visible);

    if (isUserOnlineForType) {
      await supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'user_returned' })
        .eq('id', sms.id);
      continue;
    }

    let eventMeta = eventCache.get(sms.event_id as string);
    if (!eventMeta) {
      const { data: eventRow } = await supabase
        .from('events')
        .select('starts_at, ends_at, sms_notifications_enabled')
        .eq('id', sms.event_id)
        .maybeSingle();

      if (!eventRow) {
        await supabase
          .from('pending_sms')
          .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'event_missing' })
          .eq('id', sms.id);
        continue;
      }

      eventMeta = {
        starts_at: eventRow.starts_at as string,
        ends_at: eventRow.ends_at as string,
        sms_notifications_enabled: !!eventRow.sms_notifications_enabled,
      };
      eventCache.set(sms.event_id as string, eventMeta);
    }

    if (!eventMeta.sms_notifications_enabled) {
      await supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'event_sms_disabled' })
        .eq('id', sms.id);
      continue;
    }

    const nowDate = new Date();
    const activeNow = isEventActiveNow(eventMeta.starts_at, eventMeta.ends_at, nowDate);
    const ignoreQuietHours = (sms.message_type === 'like' || sms.message_type === 'message' || sms.message_type === 'match') && activeNow;

    if (!ignoreQuietHours && isQuietHoursInIsrael(nowDate)) {
      await supabase
        .from('pending_sms')
        .update({ scheduled_at: nextAllowedDispatchTime(nowDate).toISOString() })
        .eq('id', sms.id);
      continue;
    }

    // Inactivity nudge is valid only if the participant still has no likes/messages sent.
    if (sms.message_type === 'inactivity') {
      const [likesRes, messagesRes] = await Promise.all([
        supabase
          .from('likes')
          .select('id')
          .eq('event_id', sms.event_id)
          .eq('from_participant_id', sms.recipient_id)
          .limit(1),
        supabase
          .from('messages')
          .select('id')
          .eq('event_id', sms.event_id)
          .eq('sender_participant_id', sms.recipient_id)
          .limit(1),
      ]);

      const hasEngaged = (likesRes.data?.length ?? 0) > 0 || (messagesRes.data?.length ?? 0) > 0;
      if (hasEngaged) {
        await supabase
          .from('pending_sms')
          .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'user_engaged' })
          .eq('id', sms.id);
        continue;
      }
    }

    try {
      const result = await sendSms({ to: sms.phone as string, message: sms.body as string });

      if (!result.success) {
        failed++;
        await logReliabilityMetric({
          eventId: sms.event_id as string,
          type: 'sms_delivery_failed',
          messageType: sms.message_type as string,
          reason: result.error ?? 'provider_error',
        });
        await recordSmsAttemptFailure({
          smsId: sms.id as string,
          currentAttempts: Number(sms.attempts ?? 0),
          reason: 'provider_error',
        });
        logger.error('[DISPATCH_SMS_CRON] send failed for sms.id=' + sms.id, result.error);
        // Keep as pending for retry until max attempts, then auto-cancel.
        continue;
      }

      const sentAt = new Date().toISOString();

      // Mark as sent + record quota in parallel
      await Promise.all([
        supabase
          .from('pending_sms')
          .update({ sent_at: sentAt })
          .eq('id', sms.id),
        supabase
          .from('sms_quotas')
          .insert({
            event_id: sms.event_id,
            participant_id: sms.recipient_id,
            message_type: sms.message_type,
            sent_at: sentAt,
          }),
        logReliabilityMetric({
          eventId: sms.event_id as string,
          type: 'sms_delivery_success',
          messageType: sms.message_type as string,
        }),
      ]);

      dispatched++;
    } catch (err) {
      logger.error('[DISPATCH_SMS_CRON] send failed for sms.id=' + sms.id, err);
      failed++;
      await logReliabilityMetric({
        eventId: sms.event_id as string,
        type: 'sms_delivery_failed',
        messageType: sms.message_type as string,
        reason: 'exception',
      });
      await recordSmsAttemptFailure({
        smsId: sms.id as string,
        currentAttempts: Number(sms.attempts ?? 0),
        reason: 'exception',
      });
    }

    if (INTER_SMS_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, INTER_SMS_DELAY_MS));
    }
  }

  logger.info(`[DISPATCH_SMS_CRON] Done: dispatched=${dispatched} failed=${failed}`);
  return NextResponse.json({ dispatched, failed });
}

export const GET = handler;
export const POST = handler;
