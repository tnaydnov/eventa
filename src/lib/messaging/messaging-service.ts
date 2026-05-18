/**
 * High-level messaging orchestrator.
 * All messages (OTP, pre-event, welcome, feedback) are sent via SMS.
 * Logs all messages to the message_log table.
 */
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { maskPhone } from './phone-utils';
import { sendSms } from './sms-provider';
import {
  otpSmsText,
  preEventSmsText,
  welcomeSmsText,
  feedbackSmsText,
} from './templates';
import type {
  EventMessagingConfig,
  SendResult,
  MessageChannel,
  MessagePurpose,
} from './types';

// ── Internal: log to message_log table ──

async function logMessage(params: {
  eventId: string;
  phone: string;
  channel: MessageChannel;
  messageType: MessagePurpose;
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
      status: params.status,
      provider_message_id: params.providerMessageId || null,
      error_message: params.errorMessage || null,
    });
  } catch (err) {
    logger.error('[MESSAGING] Failed to log message', { error: err });
  }
}

async function logSmsReliability(params: {
  eventId: string;
  messageType: MessagePurpose;
  success: boolean;
  error?: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('event_reliability_metrics').insert({
      event_id: params.eventId,
      metric_type: params.success ? 'sms_delivery_success' : 'sms_delivery_failed',
      source: 'unknown',
      value: 1,
      metadata: {
        messageType: params.messageType,
        ...(params.error ? { reason: params.error } : {}),
      },
    });
  } catch (err) {
    logger.error('[MESSAGING] Failed to log SMS reliability metric', { error: err });
  }
}

// ── Public API ──

/**
 * Send OTP code via SMS.
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

  await logSmsReliability({
    eventId,
    messageType: 'otp',
    success: result.success,
    error: result.error,
  });

  return {
    success: result.success,
    channel: 'sms',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send pre-event reminder via SMS.
 */
export async function sendPreEventMessage(
  phone: string,
  config: EventMessagingConfig
): Promise<SendResult> {
  const text = preEventSmsText(config);
  const result = await sendSms({ to: phone, message: text });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'sms',
    messageType: 'pre_event',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  await logSmsReliability({
    eventId: config.eventId,
    messageType: 'pre_event',
    success: result.success,
    error: result.error,
  });

  return {
    success: result.success,
    channel: 'sms',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send welcome message via SMS.
 * Only sent if this phone did NOT receive a pre-event message.
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
    return { success: true, channel: 'sms', messageId: null, error: null };
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
    return { success: true, channel: 'sms', messageId: null, error: null };
  }

  const text = welcomeSmsText(config);
  const result = await sendSms({ to: phone, message: text });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'sms',
    messageType: 'welcome',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  await logSmsReliability({
    eventId: config.eventId,
    messageType: 'welcome',
    success: result.success,
    error: result.error,
  });

  return {
    success: result.success,
    channel: 'sms',
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Send feedback/thank-you message via SMS.
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
    return { success: true, channel: 'sms', messageId: null, error: null };
  }

  const text = feedbackSmsText(config);
  const result = await sendSms({ to: phone, message: text });

  await logMessage({
    eventId: config.eventId,
    phone,
    channel: 'sms',
    messageType: 'feedback',
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId,
    errorMessage: result.error,
  });

  await logSmsReliability({
    eventId: config.eventId,
    messageType: 'feedback',
    success: result.success,
    error: result.error,
  });

  return {
    success: result.success,
    channel: 'sms',
    messageId: result.messageId,
    error: result.error,
  };
}
