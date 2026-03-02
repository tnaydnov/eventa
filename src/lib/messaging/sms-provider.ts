/**
 * InforUMobile SMS provider for the Israeli market.
 *
 * API docs: https://www.inforu.co.il/api-docs
 * Pricing: ~₪0.04 per domestic SMS
 *
 * This provider is used ONLY for OTP codes.
 * WhatsApp is used for all other messages (welcome, pre-event, feedback).
 *
 * When SMS_PROVIDER_LIVE is false, the provider logs the message
 * and returns a stub success — no real SMS is sent.
 */
import { SMS_PROVIDER_LIVE } from '@/lib/config';
import { logger } from '@/lib/logger';
import type { SendSmsParams, SendSmsResult } from './types';

/** InforUMobile API v2 endpoint */
const API_URL = 'https://api.inforu.co.il/api/v2/SMS/SendSMS';

/**
 * Send an SMS via InforUMobile.
 * In stub mode (SMS_PROVIDER_LIVE=false), logs and returns success.
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  // ── Stub mode ──
  if (!SMS_PROVIDER_LIVE) {
    logger.info('[SMS_STUB] Would send SMS', {
      to: params.to,
      messageLength: params.message.length,
    });
    return { success: true, messageId: `stub_${Date.now()}`, error: null };
  }

  // ── Live mode ──
  const token = process.env.INFORU_API_TOKEN;
  const senderName = process.env.INFORU_SENDER_NAME || 'Eventa';

  if (!token) {
    return { success: false, messageId: null, error: 'INFORU_API_TOKEN not configured' };
  }

  // InforUMobile expects local format without +972 prefix
  const localPhone = toLocalFormat(params.to);

  const body = {
    Data: {
      Message: params.message,
      Recipients: [{ Phone: localPhone }],
      Settings: {
        Sender: senderName,
      },
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, messageId: null, error: `HTTP ${response.status}: ${text}` };
    }

    const result = await response.json();

    // InforUMobile returns StatusDescription: "OK" on success
    if (result.StatusDescription === 'OK' || result.Status === 1) {
      return { success: true, messageId: result.MessageId || null, error: null };
    }

    return {
      success: false,
      messageId: null,
      error: result.StatusDescription || 'Unknown SMS error',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[SMS] Send failed', { to: params.to, error: message });
    return { success: false, messageId: null, error: message };
  }
}

/** Convert E.164 (+972...) to local Israeli format (05...) */
function toLocalFormat(phone: string): string {
  if (phone.startsWith('+972')) {
    return '0' + phone.slice(4);
  }
  return phone;
}
