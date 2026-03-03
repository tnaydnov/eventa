/**
 * TextMe SMS provider for the Israeli market.
 *
 * API docs: https://docs.textme.co.il/guide/
 *
 * This provider is used ONLY for OTP codes.
 * WhatsApp is used for all other messages (welcome, pre-event, feedback).
 *
 * When SMS_PROVIDER_LIVE is false, the provider logs the message
 * and returns a stub success - no real SMS is sent.
 */
import { SMS_PROVIDER_LIVE } from '@/lib/config';
import { logger } from '@/lib/logger';
import type { SendSmsParams, SendSmsResult } from './types';

/** TextMe Send-SMS endpoint */
const API_URL = 'https://my.textme.co.il/api';

/** TextMe error-code map (non-zero = failure) */
const ERROR_CODES: Record<number, string> = {
  3: 'Authentication failed (invalid token or username)',
  4: 'No SMS credit remaining',
  9: 'Invalid phone number (too short/long)',
  10: 'Expired API token',
  12: 'Unverified OTP code on TextMe account',
};

/**
 * Send an SMS via TextMe.
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
  const token = process.env.TEXTME_API_TOKEN;
  const username = process.env.TEXTME_USERNAME;
  const source = process.env.TEXTME_SENDER_NAME || 'Eventa';

  if (!token || !username) {
    return {
      success: false,
      messageId: null,
      error: 'TEXTME_API_TOKEN or TEXTME_USERNAME not configured',
    };
  }

  // TextMe expects local format (05xxxxxxxx or 5xxxxxxxx)
  const localPhone = toLocalFormat(params.to);

  const body = {
    sms: {
      user: { username },
      source,
      destinations: { phone: localPhone },
      message: params.message,
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, messageId: null, error: `HTTP ${response.status}: ${text}` };
    }

    const result = await response.json();

    // TextMe returns status 0 on success
    if (result.status === 0) {
      return {
        success: true,
        messageId: result.shipment_id || null,
        error: null,
      };
    }

    const knownError = ERROR_CODES[result.status as number];
    return {
      success: false,
      messageId: null,
      error: knownError || result.message || `TextMe error (status ${result.status})`,
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
