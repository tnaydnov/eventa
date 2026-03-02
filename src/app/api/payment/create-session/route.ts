import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getServiceClient } from '@/lib/supabase';
import { createClearingSession, isConfigured } from '@/lib/invoice4u';
import { APP_BASE_URL } from '@/lib/config';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/payment/create-session
 *
 * Creates an Invoice4U Clearing session for card tokenisation.
 * Returns a ClearingRedirectUrl to embed in an iframe.
 *
 * Body: { requestId, contactName, contactPhone, contactEmail, totalPriceShekel, eventName }
 */
export async function POST(req: NextRequest) {
  // CSRF check
  if (!checkCsrf(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`payment-session:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Check Invoice4U is configured
  if (!isConfigured()) {
    logger.warn('[PAYMENT] Invoice4U not configured — returning stub');
    return NextResponse.json({
      error: 'Payment provider not configured',
      stub: true,
    }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { requestId, contactName, contactPhone, contactEmail, totalPriceShekel, eventName } = body;

    if (!requestId || !contactName || !contactPhone || !contactEmail || !totalPriceShekel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the request exists and is in the right state
    const supabase = getServiceClient();
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('id, payment_status')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.payment_status !== 'awaiting_payment') {
      return NextResponse.json({ error: 'Invalid payment state' }, { status: 400 });
    }

    // Build callback URL
    const returnUrl = `${APP_BASE_URL}/api/payment/callback?rid=${requestId}`;

    // Create clearing session (tokenise only — no charge)
    const description = eventName
      ? `Eventa — ${eventName}`
      : 'Eventa — חבילת אירוע';

    const result = await createClearingSession({
      fullName: contactName,
      phone: contactPhone,
      email: contactEmail,
      sum: totalPriceShekel,
      description,
      orderId: requestId,
      returnUrl,
      tokenOnly: true,
      language: 'he',
    });

    if (!result.success || !result.data) {
      logger.error('[PAYMENT] Failed to create clearing session', { error: result.error });
      return NextResponse.json({ error: 'Payment session creation failed' }, { status: 502 });
    }

    // Save clearing IDs on the event request
    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({
        clearing_log_id: result.data.clearingLogId,
        clearing_payment_id: result.data.paymentId,
        clearing_trace_id: result.data.clearingTraceId,
        invoice4u_customer_id: result.data.customerId,
      })
      .eq('id', requestId);

    if (updateErr) {
      logger.error('[PAYMENT] Failed to save clearing IDs', { error: updateErr.message });
      // Non-fatal — the session was created, customer can still pay
    }

    logger.info('[PAYMENT] Clearing session created', {
      requestId,
      paymentId: result.data.paymentId,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: result.data.clearingRedirectUrl,
    });
  } catch (err) {
    logger.error('[PAYMENT] create-session error', err);
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
