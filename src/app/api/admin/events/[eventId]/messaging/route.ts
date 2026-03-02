import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import {
  adminMessagingPatchSchema,
  adminMessagingTriggerSchema,
} from '@/lib/validations';
import { sendPreEventMessage, sendFeedbackMessage } from '@/lib/messaging';
import type { EventMessagingConfig } from '@/lib/messaging/types';

/** Max messages per manual trigger (Vercel 15s limit). */
const MAX_MESSAGES_PER_TRIGGER = 50;
/** Delay between sends to avoid rate-limiting from providers. */
const INTER_MESSAGE_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET /api/admin/events/[eventId]/messaging
 * Get the messaging status overview for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-messaging-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    // Parallel queries for all messaging-related data
    const [eventRes, guestsRes, tokenRes, logRes, participantsRes] =
      await Promise.all([
        supabase
          .from('events')
          .select(
            'id, wa_messages_enabled, guest_list_uploaded, guest_list_uploaded_at, guest_list_count'
          )
          .eq('id', eventId)
          .single(),
        supabase
          .from('event_guest_phones')
          .select('id, wa_pre_event_sent')
          .eq('event_id', eventId),
        supabase
          .from('client_portal_tokens')
          .select('token, created_at, last_used_at')
          .eq('event_id', eventId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('message_log')
          .select('id, channel, message_type, status')
          .eq('event_id', eventId),
        supabase
          .from('participants')
          .select('id, feedback_sent, sms_consent')
          .eq('event_id', eventId),
      ]);

    if (eventRes.error || !eventRes.data) {
      return jsonError('Event not found', 404);
    }

    const event = eventRes.data;
    const guests = guestsRes.data || [];
    const logs = logRes.data || [];
    const participants = participantsRes.data || [];

    // Compute message stats from log
    const preEventSent = logs.filter(
      (l: { message_type: string; status: string }) =>
        l.message_type === 'pre_event' && l.status === 'sent'
    ).length;
    const preEventFailed = logs.filter(
      (l: { message_type: string; status: string }) =>
        l.message_type === 'pre_event' && l.status === 'failed'
    ).length;
    const welcomeSent = logs.filter(
      (l: { message_type: string; status: string }) =>
        l.message_type === 'welcome' && l.status === 'sent'
    ).length;
    const feedbackSent = participants.filter(
      (p: { feedback_sent: boolean }) => p.feedback_sent
    ).length;
    const feedbackEligible = participants.filter(
      (p: { sms_consent: boolean }) => p.sms_consent
    ).length;

    // Estimated cost (simplified)
    const waMessages = logs.filter(
      (l: { channel: string; status: string }) =>
        l.channel === 'whatsapp' && l.status === 'sent'
    ).length;
    const smsMessages = logs.filter(
      (l: { channel: string; status: string }) =>
        l.channel === 'sms' && l.status === 'sent'
    ).length;
    const estimatedCost = waMessages * 0.15 + smsMessages * 0.04;

    // Try to read messaging_config (column may not exist yet in DB)
    let msgConfig: Record<string, unknown> | null = null;
    const { data: cfgRow, error: cfgErr } = await supabase
      .from('events')
      .select('messaging_config')
      .eq('id', eventId)
      .single();
    if (!cfgErr && cfgRow) {
      msgConfig = (cfgRow.messaging_config as Record<string, unknown>) ?? null;
    }

    return NextResponse.json({
      wa_messages_enabled: event.wa_messages_enabled,
      guest_list_uploaded: event.guest_list_uploaded,
      guest_list_uploaded_at: event.guest_list_uploaded_at,
      guest_list_count: event.guest_list_count,
      pre_event_sent: guests.some(
        (g: { wa_pre_event_sent: boolean }) => g.wa_pre_event_sent
      ),
      pre_event_sent_count: preEventSent,
      pre_event_failed_count: preEventFailed,
      welcome_sent_count: welcomeSent,
      feedback_sent_count: feedbackSent,
      feedback_eligible_count: feedbackEligible,
      estimated_cost: Math.round(estimatedCost * 100) / 100,
      portal_token: tokenRes.data?.token ?? null,
      portal_last_used_at: tokenRes.data?.last_used_at ?? null,
      messaging_config: {
        pre_event_hours_before:
          (msgConfig?.pre_event_hours_before as number) ?? 3,
        feedback_hours_after:
          (msgConfig?.feedback_hours_after as number) ?? 3,
        upload_reminder_days:
          (msgConfig?.upload_reminder_days as number[]) ?? [7, 3],
      },
    });
  } catch (err) {
    logger.error('[ADMIN_MESSAGING_GET] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * PATCH /api/admin/events/[eventId]/messaging
 * Toggle WA messaging on/off and/or update timing config.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-messaging-patch', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const body = await req.json();
    const parsed = adminMessagingPatchSchema.safeParse(body);
    if (!parsed.success) return jsonError('Invalid input', 400);

    const supabase = getServiceClient();

    const updates: Record<string, unknown> = {};

    if (parsed.data.wa_messages_enabled !== undefined) {
      updates.wa_messages_enabled = parsed.data.wa_messages_enabled;
    }

    if (parsed.data.messaging_config) {
      // Merge with existing config (column may not exist yet in DB)
      const { data: current, error: cfgErr } = await supabase
        .from('events')
        .select('messaging_config')
        .eq('id', eventId)
        .single();

      if (!cfgErr) {
        const existing =
          (current?.messaging_config as Record<string, unknown>) || {};
        updates.messaging_config = {
          ...existing,
          ...parsed.data.messaging_config,
        };
      } else {
        logger.warn('[ADMIN_MESSAGING_PATCH] messaging_config column not available, skipping');
      }
    }

    if (Object.keys(updates).length === 0) {
      return jsonError('No changes provided', 400);
    }

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId);

    if (error) {
      logger.error('[ADMIN_MESSAGING_PATCH] update error:', error.message);
      return jsonError('Failed to update messaging settings', 500);
    }

    adminAuditLog('MESSAGING_UPDATE', { eventId, updates }, req);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[ADMIN_MESSAGING_PATCH] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * POST /api/admin/events/[eventId]/messaging
 * Manually trigger pre-event or feedback messages NOW.
 * Body: { action: 'send_pre_event' | 'send_feedback' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-messaging-trigger', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const body = await req.json();
    const parsed = adminMessagingTriggerSchema.safeParse(body);
    if (!parsed.success) return jsonError('Invalid input', 400);

    const supabase = getServiceClient();

    // Load event for messaging config
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, slug, name, join_code, wa_messages_enabled, starts_at')
      .eq('id', eventId)
      .single();

    if (evErr || !event) return jsonError('Event not found', 404);
    if (!event.wa_messages_enabled) {
      return jsonError('WhatsApp messaging is not enabled for this event', 400);
    }

    const config: EventMessagingConfig = {
      eventId: event.id,
      eventSlug: event.slug,
      eventName: event.name,
      joinCode: event.join_code,
      waMessagesEnabled: event.wa_messages_enabled,
    };

    if (parsed.data.action === 'send_pre_event') {
      return await handleManualPreEvent(supabase, eventId, config);
    }

    if (parsed.data.action === 'send_feedback') {
      return await handleManualFeedback(supabase, eventId, config, req);
    }

    return jsonError('Unknown action', 400);
  } catch (err) {
    logger.error('[ADMIN_MESSAGING_TRIGGER] error:', err);
    return jsonError('Server error', 500);
  }
}

// ─── Manual Trigger Helpers ─────────────────────────────

async function handleManualPreEvent(
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string,
  config: EventMessagingConfig
) {
  const { data: guests } = await supabase
    .from('event_guest_phones')
    .select('id, phone, guest_name, wa_pre_event_sent')
    .eq('event_id', eventId)
    .eq('wa_pre_event_sent', false)
    .limit(MAX_MESSAGES_PER_TRIGGER);

  if (!guests || guests.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      message: 'אין אורחים שטרם נשלחה אליהם הודעה',
    });
  }

  let sent = 0;
  let failed = 0;

  for (const guest of guests) {
    const result = await sendPreEventMessage(
      guest.phone,
      config,
      guest.guest_name
    );

    if (result.success) {
      sent++;
      await supabase
        .from('event_guest_phones')
        .update({
          wa_pre_event_sent: true,
          wa_pre_event_sent_at: new Date().toISOString(),
          wa_marketing_window_opened_at: new Date().toISOString(),
        })
        .eq('id', guest.id);
    } else {
      failed++;
    }

    if (guests.indexOf(guest) < guests.length - 1) {
      await sleep(INTER_MESSAGE_DELAY_MS);
    }
  }

  adminAuditLog('MANUAL_PRE_EVENT_SEND', { eventId, sent, failed });

  return NextResponse.json({ sent, failed });
}

async function handleManualFeedback(
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string,
  config: EventMessagingConfig,
  req: NextRequest
) {
  const { data: participants } = await supabase
    .from('participants')
    .select('id, phone, sms_consent, feedback_consent, feedback_sent')
    .eq('event_id', eventId)
    .eq('feedback_sent', false)
    .eq('sms_consent', true)
    .eq('feedback_consent', true)
    .not('phone', 'is', null)
    .limit(MAX_MESSAGES_PER_TRIGGER);

  if (!participants || participants.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      message: 'אין משתתפים שטרם נשלחה אליהם הודעת פידבק',
    });
  }

  let sent = 0;
  let failed = 0;

  for (const p of participants) {
    if (!p.phone) continue;

    const result = await sendFeedbackMessage(p.phone, config);

    // Mark feedback_sent regardless of success (don't retry)
    await supabase
      .from('participants')
      .update({ feedback_sent: true })
      .eq('id', p.id);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    if (participants.indexOf(p) < participants.length - 1) {
      await sleep(INTER_MESSAGE_DELAY_MS);
    }
  }

  adminAuditLog('MANUAL_FEEDBACK_SEND', { eventId, sent, failed }, req);

  return NextResponse.json({ sent, failed });
}
