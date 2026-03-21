/**
 * High-level messaging orchestrator.
 * Determines which channel to use and delegates to providers.
 * Logs all messages to the message_log table.
 */
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { maskPhone } from './phone-utils';
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
 * Uses utility template (transactional, not marketing).
 */
export async function sendPreEventMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: WA_TEMPLATES.PRE_EVENT,
    templateLanguage: 'he',
    components: [
      {
        type: 'body',
        parameters: preEventVars(config),
      },
    ],
  });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'whatsapp',
    messageType: 'pre_event',
    waCategory: 'utility',
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
 * Uses utility template (transactional, not marketing).
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
      phone: maskPhone(phone),
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
      phone: maskPhone(phone),
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
    waCategory: 'utility',
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
 * Send feedback/thank-you message via WhatsApp.
 * Uses utility template — no marketing window required.
 * Includes feedback survey link and website link.
 */
export async function sendFeedbackMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  // Check if feedback was already sent to this phone for this event
  const supabase = getServiceClient();
  const { data: existingMsg } = await supabase
    .from('message_log')
    .select('id')
    .eq('event_id', config.eventId)
    .eq('phone', phone)
    .eq('message_type', 'feedback')
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();

  if (existingMsg) {
    logger.info('[MESSAGING] Skipping feedback - already sent', {
      phone: maskPhone(phone),
      eventId: config.eventId,
    });
    return { success: true, channel: 'whatsapp', messageId: null, error: null };
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
    waCategory: 'utility',
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
