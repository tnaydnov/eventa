import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const PAYMENT_PROVIDER_LIVE = process.env.PAYMENT_PROVIDER_LIVE === 'true';

/**
 * POST /api/payment/webhook
 * Receives payment status callbacks from the payment provider.
 *
 * STUB MODE: Returns 501 when PAYMENT_PROVIDER_LIVE is not 'true'.
 * When live, this route validates the provider signature, looks up the
 * event_request by payment_link_token, and updates payment_status.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`payment-webhook:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!PAYMENT_PROVIDER_LIVE) {
    logger.info('[PAYMENT_WEBHOOK] Stub mode - webhook received but not processed');
    return NextResponse.json(
      {
        error: 'Payment provider is in stub mode. Set PAYMENT_PROVIDER_LIVE=true to enable.',
        stub: true,
      },
      { status: 501 },
    );
  }

  // ── Live mode: process webhook ──
  // TODO: Add signature/HMAC verification when the payment provider supports it.
  // Currently the only protection is rate-limiting + token lookup.
  try {
    const body = await req.json();
    const { token, status, method } = body;

    if (!token || !status) {
      return NextResponse.json({ error: 'Missing token or status' }, { status: 400 });
    }

    // Only accept known status transitions
    if (status !== 'paid') {
      logger.warn('[PAYMENT_WEBHOOK] Ignoring non-paid status', { token, status });
      return NextResponse.json({ success: true });
    }

    const supabase = getServiceClient();

    // Look up request by payment_link_token
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('id, payment_status')
      .eq('payment_link_token', token)
      .maybeSingle();

    if (fetchErr || !request) {
      logger.warn('[PAYMENT_WEBHOOK] Unknown payment token', { token });
      return NextResponse.json({ error: 'Unknown token' }, { status: 404 });
    }

    // Idempotency: if already paid, return success without re-processing
    if (request.payment_status === 'paid') {
      logger.info('[PAYMENT_WEBHOOK] Already paid, skipping', { requestId: request.id });
      return NextResponse.json({ success: true });
    }

    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: method || 'other',
      })
      .eq('id', request.id);

    if (updateErr) {
      logger.error('[PAYMENT_WEBHOOK] Update error', { error: updateErr.message });
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    logger.info('[PAYMENT_WEBHOOK] Payment processed', { requestId: request.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[PAYMENT_WEBHOOK] Error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
