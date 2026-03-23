/**
 * Shared types for the messaging abstraction layer.
 * Used by SMS provider and messaging service.
 */

/** Channel types */
export type MessageChannel = 'sms';

/** Message purpose types */
export type MessagePurpose = 'otp' | 'pre_event' | 'welcome' | 'feedback';

/** Result from any send operation */
export interface SendResult {
  success: boolean;
  channel: MessageChannel;
  messageId: string | null;
  error: string | null;
}

/** Messaging service configuration per event */
export interface EventMessagingConfig {
  eventId: string;
  eventName: string;
  eventSlug: string;
  joinCode: string;
  messagesEnabled: boolean;
}

/** SMS provider send parameters */
export interface SendSmsParams {
  to: string;       // E.164 format: +972501234567
  message: string;  // Plain text
}

/** SMS provider send result */
export interface SendSmsResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}
