/**
 * 360dialog WhatsApp Business API client.
 *
 * API docs: https://docs.360dialog.com/
 * Uses Meta's Cloud API through 360dialog's proxy endpoint.
 *
 * Message categories (Meta pricing):
 * - Authentication: OTP codes (not used - we use SMS for OTP)
 * - Marketing: pre-event reminders, welcome messages, feedback (~₪0.15/conversation)
 * - Utility: transactional (not used currently)
 *
 * Conversation window: 24 hours per category.
 * All our WA messages are Marketing → one window per user per 24h.
 *
 * When WA_PROVIDER_LIVE is false, the provider logs the message
 * and returns a stub success - no real WhatsApp message is sent.
 */
import { WA_PROVIDER_LIVE } from '@/lib/config';
import { logger } from '@/lib/logger';
import type { SendWaTemplateParams, SendWaResult } from './types';

/** 360dialog API base URL */
const API_BASE = 'https://waba.360dialog.io/v1';

/**
 * Send a WhatsApp template message via 360dialog.
 * In stub mode (WA_PROVIDER_LIVE=false), logs and returns success.
 */
export async function sendWhatsAppTemplate(
  params: SendWaTemplateParams
): Promise<SendWaResult> {
  // ── Stub mode ──
  if (!WA_PROVIDER_LIVE) {
    logger.info('[WA_STUB] Would send WhatsApp template', {
      to: params.to,
      template: params.templateName,
      language: params.templateLanguage,
    });
    return { success: true, messageId: `wa_stub_${Date.now()}`, error: null };
  }

  // ── Live mode ──
  const apiKey = process.env.WA_API_KEY;
  if (!apiKey) {
    return { success: false, messageId: null, error: 'WA_API_KEY not configured' };
  }

  const body = {
    messaging_product: 'whatsapp',
    to: params.to.replace('+', ''), // 360dialog expects without '+'
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.templateLanguage },
      components: params.components || [],
    },
  };

  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        messageId: null,
        error: (err as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: (result as { messages?: Array<{ id?: string }> }).messages?.[0]?.id || null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[WA] Send failed', { to: params.to, template: params.templateName, error: message });
    return { success: false, messageId: null, error: message };
  }
}
