/**
 * TextMe SMS provider for the Israeli market.
 *
 * API docs: https://docs.textme.co.il/sms/
 * Examples: https://docs.textme.co.il/sms/example.html
 *
 * This provider is used for ALL messages:
 * OTP codes, pre-event reminders, welcome messages, and feedback.
 *
 * When SMS_PROVIDER_LIVE is false, the provider logs the message
 * and returns a stub success — no real SMS is sent.
 */
import { SMS_PROVIDER_LIVE } from '@/lib/config';
import { logger } from '@/lib/logger';
import { maskPhone } from './phone-utils';
import type { SendSmsParams, SendSmsResult } from './types';

/** TextMe Send-SMS endpoint (same for XML and JSON) */
const API_URL = 'https://my.textme.co.il/api';

/**
 * TextMe error-code map (non-zero = failure).
 * Full list: https://docs.textme.co.il/sms/errors-and-status.html
 */
const ERROR_CODES: Record<number, string> = {
  1: 'Problem parsing request body',
  2: 'Missing required field (see message for details)',
  3: 'Username or password is incorrect / API token is invalid',
  4: 'Not enough credit',
  5: 'No permission to send SMS at this time',
  6: 'Process failure',
  7: 'Cannot send in this format - use bulk endpoint for groups',
  8: 'All numbers are on blocked list',
  9: 'Destination phone number too short or too long',
  10: 'Username/password incorrect or expired API token',
  11: 'API token valid but does not match username (or newer token exists)',
  12: 'Not enough money / Unverified OTP code',
  515: 'Unverified sender source',
  989: 'Message too long/short or campaign name too long',
  992: 'Source (sender name) too long or too short',
  997: 'Not a valid command sent',
  998: 'Unknown error in request',
  999: 'Contact TextMe support',
};

/**
 * Send an SMS via TextMe.
 * In stub mode (SMS_PROVIDER_LIVE=false), logs and returns success.
 *
 * JSON format follows the official Node.js example:
 * https://docs.textme.co.il/sms/example.html
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  // ── Stub mode ──
  if (!SMS_PROVIDER_LIVE) {
    logger.warn('[SMS_STUB] SMS_PROVIDER_LIVE is false — SMS NOT sent', {
      to: maskPhone(params.to),
      messageLength: params.message.length,
      hint: 'Set SMS_PROVIDER_LIVE=true in .env.local to send real SMS',
    });
    return { success: true, messageId: `stub_${Date.now()}`, error: null };
  }

  // ── Live mode ──
  const token = process.env.TEXTME_API_TOKEN;
  const username = process.env.TEXTME_USERNAME;
  const source = process.env.TEXTME_SENDER_NAME || 'Eventa';

  if (!token || !username) {
    logger.error('[SMS] Missing credentials', {
      hasToken: !!token,
      hasUsername: !!username,
    });
    return {
      success: false,
      messageId: null,
      error: 'TEXTME_API_TOKEN or TEXTME_USERNAME not configured',
    };
  }

  // TextMe expects local format: 05xxxxxxxx or 5xxxxxxxx
  const localPhone = toLocalFormat(params.to);

  // JSON body format per TextMe docs:
  // https://docs.textme.co.il/sms/example.html#node-js-example
  const body = {
    sms: {
      user: {
        username: username,
      },
      source: source,
      destinations: {
        phone: localPhone,
      },
      message: params.message,
    },
  };

  logger.info('[SMS] Sending via TextMe', {
    to: maskPhone(params.to),
    source,
    messageLength: params.message.length,
  });

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    // Try to parse as JSON
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      logger.error('[SMS] Non-JSON response from TextMe', {
        status: response.status,
        body: responseText.slice(0, 500),
      });
      return {
        success: false,
        messageId: null,
        error: `HTTP ${response.status}: Non-JSON response — ${responseText.slice(0, 200)}`,
      };
    }

    if (!response.ok) {
      logger.error('[SMS] TextMe HTTP error', {
        httpStatus: response.status,
        response: result,
      });
      return {
        success: false,
        messageId: null,
        error: `HTTP ${response.status}: ${result.message || responseText.slice(0, 200)}`,
      };
    }

    // TextMe returns status 0 on success (may be number or string)
    // Using == to handle both "0" and 0 as the official example does
    const status = Number(result.status);

    if (status === 0) {
      logger.info('[SMS] Sent successfully', {
        to: maskPhone(params.to),
        shipmentId: result.shipment_id,
      });
      return {
        success: true,
        messageId: (result.shipment_id as string) || null,
        error: null,
      };
    }

    const knownError = ERROR_CODES[status];
    const errorMsg =
      knownError || (result.message as string) || `TextMe error (status ${result.status})`;
    logger.error('[SMS] TextMe returned error', {
      to: maskPhone(params.to),
      status: result.status,
      message: result.message,
      knownError,
    });
    return { success: false, messageId: null, error: errorMsg };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[SMS] Send failed (network/exception)', {
      to: maskPhone(params.to),
      error: message,
    });
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
