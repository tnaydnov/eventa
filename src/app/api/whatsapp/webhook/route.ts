/**
 * WhatsApp Cloud API Webhook endpoint.
 *
 * GET  — Webhook verification challenge (called by Meta when you register the webhook URL).
 * POST — Receives status updates (sent/delivered/read/failed) for outbound messages.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 *
 * Configure in Meta App Dashboard → WhatsApp → Configuration → Webhook URL:
 *   https://eventa.productions/api/whatsapp/webhook
 *
 * Environment variables required:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN — arbitrary string you set in the Meta dashboard
 *   WHATSAPP_APP_SECRET           — your Meta app secret (for payload signature verification)
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ── GET: Webhook Verification ──────────────────────────────

/**
 * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
 * We must verify the token matches ours and respond with the challenge value.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error('[WA_WEBHOOK] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[WA_WEBHOOK] Verification successful');
    // Must respond with the challenge value as plain text
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('[WA_WEBHOOK] Verification failed', { mode, tokenMatch: token === verifyToken });
  return new NextResponse('Forbidden', { status: 403 });
}

// ── POST: Event Notifications ──────────────────────────────

/**
 * Receives message status webhooks from Meta.
 * Validates the X-Hub-Signature-256 header and updates message_log.
 */
export async function POST(req: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const rawBody = await req.text();

  // Validate signature if app secret is configured
  if (appSecret) {
    const signature = req.headers.get('x-hub-signature-256') || '';
    const expectedSig =
      'sha256=' +
      crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      logger.warn('[WA_WEBHOOK] Invalid signature');
      return new NextResponse('Invalid signature', { status: 401 });
    }
  }

  // Must always respond 200 quickly to acknowledge receipt
  try {
    const payload = JSON.parse(rawBody);
    // Process asynchronously so we respond 200 fast
    void processWebhookPayload(payload).catch((err) =>
      logger.error('[WA_WEBHOOK] Processing error', {
        error: err instanceof Error ? err.message : String(err),
      })
    );
  } catch {
    logger.warn('[WA_WEBHOOK] Invalid JSON payload');
  }

  return new NextResponse('OK', { status: 200 });
}

// ── Payload Processing ─────────────────────────────────────

interface WaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WaChange {
  value: {
    messaging_product: string;
    metadata: { display_phone_number: string; phone_number_id: string };
    statuses?: WaStatus[];
  };
  field: string;
}

interface WaEntry {
  id: string;
  changes: WaChange[];
}

interface WaWebhookPayload {
  object: string;
  entry: WaEntry[];
}

async function processWebhookPayload(payload: WaWebhookPayload) {
  if (payload.object !== 'whatsapp_business_account') return;

  const supabase = getServiceClient();

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const statuses = change.value?.statuses;
      if (!statuses) continue;

      for (const status of statuses) {
        // Update the message_log with delivery status
        if (status.id && status.status) {
          const updateData: Record<string, unknown> = {
            wa_delivery_status: status.status,
            wa_status_updated_at: new Date(
              parseInt(status.timestamp) * 1000
            ).toISOString(),
          };

          if (status.status === 'failed' && status.errors?.[0]) {
            updateData.wa_error_code = status.errors[0].code;
            updateData.wa_error_title = status.errors[0].title;
          }

          const { error } = await supabase
            .from('message_log')
            .update(updateData)
            .eq('provider_message_id', status.id);

          if (error) {
            logger.warn('[WA_WEBHOOK] Failed to update message_log', {
              messageId: status.id,
              status: status.status,
              error: error.message,
            });
          } else {
            logger.info('[WA_WEBHOOK] Status updated', {
              messageId: status.id,
              status: status.status,
            });
          }
        }
      }
    }
  }
}
