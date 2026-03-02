/**
 * Shared types for the messaging abstraction layer.
 * Used by SMS provider, WhatsApp provider, and messaging service.
 */

/** Channel types */
export type MessageChannel = 'sms' | 'whatsapp';

/** Message purpose types */
export type MessagePurpose = 'otp' | 'pre_event' | 'welcome' | 'feedback';

/** WhatsApp conversation categories (Meta pricing model) */
export type WaCategory = 'authentication' | 'marketing' | 'utility';

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
  waMessagesEnabled: boolean;
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

/** WhatsApp template component parameter */
export interface WaTemplateParam {
  type: 'text' | 'image' | 'document';
  text?: string;
  image?: { link: string };
}

/** WhatsApp template component */
export interface WaTemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters: WaTemplateParam[];
}

/** WhatsApp template send parameters */
export interface SendWaTemplateParams {
  to: string;                         // E.164: +972501234567
  templateName: string;               // Pre-approved Meta template name
  templateLanguage: string;           // e.g. 'he'
  components?: WaTemplateComponent[];
}

/** WhatsApp provider send result */
export interface SendWaResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}
