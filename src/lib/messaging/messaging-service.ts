/**
 * High-level messaging orchestrator.
 * Determines which channel to use and delegates to providers.
 * Logs all messages to the message_log table.
 */
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { WA_MARKETING_WINDOW_HOURS } from '@/lib/config';
import { DEFAULT_DISCOUNT_CODE } from '@/lib/constants';
import { sendSms } from './sms-provider';
import { sendWhatsAppTemplate } from './whatsapp-provider';
import {
  otpSmsText,
  WA_TEMPLATES,
  preEventVars,
  welcomeVars,
  feedbackVars,
} from './templates';
import type {
  EventMessagingConfig,
  SendResult,
  MessageChannel,
  MessagePurpose,
  WaCategory,
} from './types';

// ── Internal: log to message_log table ──

async function logMessage(params: {
  eventId: string;
  phone: string;
  channel: MessageChannel;
  messageType: MessagePurpose;
  waCategory?: WaCategory;
  status: 'sent' | 'failed';
  providerMessageId?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('message_log').insert({
      event_id: params.eventId,
      phone: params.phone,
      channel: params.channel,
      message_type: params.messageType,
      wa_category: params.waCategory || null,
      status: params.status,
      provider_message_id: params.providerMessageId || null,
      error_message: params.errorMessage || null,
    });
  } catch (err) {
    logger.error('[MESSAGING] Failed to log message', { error: err });
  }
}

// ── Public API ──

/**
 * Send OTP code via SMS.
 * Always uses SMS - universal, no WhatsApp dependency for auth.
 */
export async function sendOtp(
  phone: string,
  code: string,
  eventId: string
): Promise<SendResult> {
  const text = otpSmsText(code);
  const result = await sendSms({ to: phone, message: text });

  await logMessage({
    eventId,
    phone,
    channel: 'sms',
    messageType: 'otp',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'sms',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send pre-event reminder via WhatsApp.
 * Opens a 24h Marketing conversation window.
 */
export async function sendPreEventMessage(
  phone: string,
  config: EventMessagingConfig,
  guestName?: string | null
): Promise<SendResult> {
  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.PRE_EVENT,
    templateLanguage: 'he',
    components: [
      {
        type: 'body',
        parameters: preEventVars(config, guestName),
      },
    ],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'pre_event',
    waCategory: 'marketing',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'whatsapp',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send welcome message via WhatsApp.
 * Only sent if this phone did NOT receive a pre-event message.
 * Opens a new 24h Marketing window.
 */
export async function sendWelcomeMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  const supabase = getServiceClient();

  // Check: did this phone already get a pre-event message for this event?
  const { data: guestEntry } = await supabase
    .from('event_guest_phones')
    .select('wa_pre_event_sent')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .maybeSingle();

  if (guestEntry?.wa_pre_event_sent) {
    logger.info('[MESSAGING] Skipping welcome - pre-event already sent', {
      phone,
      eventId: config.eventId,
    });
    return { success: true, channel: 'whatsapp', messageId: null, error: null };
  }

  // Also check message_log as a second source of truth
  const { data: existingMsg } = await supabase
    .from('message_log')
    .select('id')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .in('message_type', ['pre_event', 'welcome'])
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();

  if (existingMsg) {
    logger.info('[MESSAGING] Skipping welcome - message already sent', {
      phone,
      eventId: config.eventId,
    });
    return { success: true, channel: 'whatsapp', messageId: null, error: null };
  }

  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.WELCOME,
    templateLanguage: 'he',
    components: [
      {
        type: 'body',
        parameters: welcomeVars(config),
      },
    ],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'welcome',
    waCategory: 'marketing',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  return {
    success: result.success,
    channel: 'whatsapp',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send feedback message via WhatsApp.
 * Only sent if a Marketing window is still open (< 24h since last WA marketing message).
 * If no open window, skip - we don't open a new window just for feedback.
 */
export async function sendFeedbackMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  const supabase = getServiceClient();

  // Check if a marketing window is open
  const windowCutoff = new Date(
    Date.now() - WA_MARKETING_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recentMsg } = await supabase
    .from('message_log')
    .select('created_at')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .eq('channel', 'whatsapp')
    .eq('wa_category', 'marketing')
    .eq('status', 'sent')
    .gte('created_at', windowCutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!recentMsg) {
    logger.info('[MESSAGING] Skipping feedback - no open WA marketing window', {
      phone,
      eventId: config.eventId,
    });
    return {
      success: false,
      channel: 'whatsapp',
      messageId: null,
      error: 'no_open_window',
    };
  }

  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.FEEDBACK,
    templateLanguage: 'he',
    components: [
      {
        type: 'body',
        parameters: feedbackVars(config),
      },
    ],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'feedback',
    waCategory: 'marketing',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  // Create discount claim record on successful feedback delivery
  if (result.success) {
    try {
      const supabase = getServiceClient();
      const eventDate = new Date().toISOString().slice(0, 10);
      await supabase.from('discount_claims').insert({
        phone,
        discount_code: DEFAULT_DISCOUNT_CODE,
        event_name: config.eventName,
        event_date: eventDate,
        event_id: config.eventId,
        wa_message_id: result.messageId || null,
      });
    } catch (dcErr) {
      // Non-fatal - feedback was already sent
      logger.warn('[MESSAGING] Failed to create discount claim', { error: dcErr });
    }
  }

  return {
    success: result.success,
    channel: 'whatsapp',
    messageId: result.messageId,
    error: result.error,
  };
}
