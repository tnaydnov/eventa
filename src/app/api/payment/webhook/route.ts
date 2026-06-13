import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyCronAuth } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { getClearingLogById, isConfigured } from '@/lib/invoice4u';

/**
 * POST /api/payment/webhook
 * Receives payment status callbacks from Invoice4U clearing.
 *
 * Invoice4U may POST here with clearing result data after a card capture
 * or charge completes. This route verifies the clearing log and updates
 * the event_request accordingly.
 *
 * Accepted body formats:
 *   - { clearingLogId: string }                 (Invoice4U server notification - verified
 *                                                server-side via getClearingLogById)
 *   - { token: string, status: string }         (manual / internal trigger - REQUIRES a valid
 *                                                Authorization: Bearer CRON_SECRET; never trusted
 *                                                from an anonymous caller)
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`payment-webhook:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!isConfigured()) {
    logger.info('[PAYMENT_WEBHOOK] Invoice4U not configured - webhook not processed');
    return NextResponse.json(
      { error: 'Payment provider not configured', stub: true },
      { status: 501 },
    );
  }

  try {
    const body = await req.json();

    // ── Invoice4U clearing log based notification ──
    const clearingLogId = body.clearingLogId || body.ClearingLogId;

    if (clearingLogId) {
      return handleClearingNotification(String(clearingLogId));
    }

    // ── Legacy token-based webhook (manual / internal trigger only) ──
    // SECURITY: a raw { token, status } body cannot be proven to originate from
    // Invoice4U (the provider sends a clearingLogId, which we verify server-side
    // above). Trusting it would let anyone mark an order "paid" by POSTing a known
    // payment_link_token - a payment-fraud vector. We therefore only honour this
    // path for an authenticated internal caller (Vercel Cron / ops with CRON_SECRET).
    // Unauthenticated callers MUST use the verified clearingLogId path.
    const { token, status } = body;

    if (!verifyCronAuth(req)) {
      logger.warn('[PAYMENT_WEBHOOK] Rejected unverified legacy webhook', {
        hasToken: !!token,
        ip,
      });
      return NextResponse.json(
        { error: 'Unverified webhook: clearingLogId required' },
        { status: 401 },
      );
    }

    if (!token || !status) {
      return NextResponse.json({ error: 'Missing clearingLogId or token+status' }, { status: 400 });
    }

    if (status !== 'paid' && status !== 'card_captured') {
      logger.warn('[PAYMENT_WEBHOOK] Ignoring status', { status });
      return NextResponse.json({ success: true });
    }

    const supabase = getServiceClient();

    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('id, payment_status')
      .eq('payment_link_token', token)
      .maybeSingle();

    if (fetchErr || !request) {
      logger.warn('[PAYMENT_WEBHOOK] Unknown payment token', { token: String(token).slice(0, 8) + '…' });
      return NextResponse.json({ error: 'Unknown token' }, { status: 404 });
    }

    if (request.payment_status === 'paid') {
      return NextResponse.json({ success: true });
    }

    const newStatus = status === 'paid' ? 'paid' : 'card_captured';

    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({
        payment_status: newStatus,
        ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
      })
      .eq('id', request.id);

    if (updateErr) {
      logger.error('[PAYMENT_WEBHOOK] Update error', { error: updateErr.message });
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    logger.info('[PAYMENT_WEBHOOK] Payment processed (legacy)', { requestId: request.id, newStatus });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[PAYMENT_WEBHOOK] Error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/* ── Invoice4U clearing log handler ─────────────────────────────────── */

async function handleClearingNotification(clearingLogId: string): Promise<NextResponse> {
  // Verify the clearing log with Invoice4U
  const logResult = await getClearingLogById(clearingLogId);

  if (!logResult.success || !logResult.data) {
    logger.warn('[PAYMENT_WEBHOOK] Clearing log verification failed', {
      clearingLogId,
      error: logResult.error,
    });
    return NextResponse.json({ error: 'Clearing log verification failed' }, { status: 400 });
  }

  const log = logResult.data;
  if (!log.isSuccess) {
    logger.info('[PAYMENT_WEBHOOK] Clearing log not successful, ignoring', { clearingLogId });
    return NextResponse.json({ success: true, ignored: true });
  }

  const supabase = getServiceClient();

  // Look up the event_request by clearing_log_id
  const { data: request, error: fetchErr } = await supabase
    .from('event_requests')
    .select('id, payment_status')
    .eq('clearing_log_id', clearingLogId)
    .maybeSingle();

  if (fetchErr || !request) {
    logger.warn('[PAYMENT_WEBHOOK] No request found for clearing log', { clearingLogId });
    return NextResponse.json({ error: 'No matching request' }, { status: 404 });
  }

  // Idempotency
  if (request.payment_status === 'paid' || request.payment_status === 'card_captured') {
    logger.info('[PAYMENT_WEBHOOK] Already processed', { requestId: request.id });
    return NextResponse.json({ success: true });
  }

  // Update to card_captured (charge happens during admin approval)
  const { error: updateErr } = await supabase
    .from('event_requests')
    .update({ payment_status: 'card_captured' })
    .eq('id', request.id);

  if (updateErr) {
    logger.error('[PAYMENT_WEBHOOK] Update error', { error: updateErr.message });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  logger.info('[PAYMENT_WEBHOOK] Card captured via clearing notification', {
    requestId: request.id,
    clearingLogId,
  });
  return NextResponse.json({ success: true });
}
