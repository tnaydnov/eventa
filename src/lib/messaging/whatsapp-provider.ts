/**
 * Meta WhatsApp Cloud API client.
 *
 * API docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Sends template messages directly via Meta's Graph API.
 *
 * Message categories (Meta pricing):
 * - Authentication: OTP codes (not used - we use SMS for OTP)
 * - Utility: transactional messages - pre-event reminders, welcome, feedback
 * - Marketing: promotional (not used)
 *
 * All our WA messages are Utility (transactional, event-related).
 * Template messages can be sent without an open customer service window.
 *
 * When WA_PROVIDER_LIVE is false, the provider logs the message
 * and returns a stub success - no real WhatsApp message is sent.
 */
import { WA_PROVIDER_LIVE } from '@/lib/config';
import { logger } from '@/lib/logger';
import { maskPhone } from './phone-utils';
import type { SendWaTemplateParams, SendWaResult } from './types';

/** Meta Graph API version */
const GRAPH_API_VERSION = 'v22.0';

/**
 * Send a WhatsApp template message via Meta Cloud API.
 * In stub mode (WA_PROVIDER_LIVE=false), logs and returns success.
 */
export async function sendWhatsAppTemplate(
  params: SendWaTemplateParams
): Promise<SendWaResult> {
  // ── Stub mode ──
  if (!WA_PROVIDER_LIVE) {
    logger.info('[WA_STUB] Would send WhatsApp template', {
      to: maskPhone(params.to),
      template: params.templateName,
      language: params.templateLanguage,
    });
    return { success: true, messageId: `wa_stub_${Date.now()}`, error: null };
  }

  // ── Live mode ──
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!apiToken) {
    return { success: false, messageId: null, error: 'WHATSAPP_API_TOKEN not configured' };
  }
  if (!phoneNumberId) {
    return { success: false, messageId: null, error: 'WHATSAPP_PHONE_NUMBER_ID not configured' };
  }

  // Meta Cloud API expects phone without '+' prefix
  const recipientPhone = params.to.replace(/^\+/, '');

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.templateLanguage },
      components: params.components || [],
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg =
        (err as { error?: { message?: string } }).error?.message ||
        `HTTP ${response.status}`;
      logger.error('[WA] HTTP error', {
        to: maskPhone(params.to),
        template: params.templateName,
        error: errorMsg,
      });
      return { success: false, messageId: null, error: errorMsg };
    }

    const result = await response.json();
    return {
      success: true,
      messageId:
        (result as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ||
        null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[WA] Send failed', {
      to: maskPhone(params.to),
      template: params.templateName,
      error: message,
    });
    return { success: false, messageId: null, error: message };
  }
}
