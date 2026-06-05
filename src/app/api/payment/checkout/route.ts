import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { escapeHtml } from '@/lib/email-templates';
import { createClearingSession, isConfigured } from '@/lib/invoice4u';
import { APP_BASE_URL, BASE_PRICE } from '@/lib/config';

const PAYMENT_PROVIDER_LIVE = process.env.PAYMENT_PROVIDER_LIVE === 'true';

/**
 * GET /api/payment/checkout?token=<payment_link_token>
 * Client-facing checkout page / redirect.
 *
 * STUB MODE: Returns 501 JSON when PAYMENT_PROVIDER_LIVE is not 'true'.
 * When live, validates the token, checks expiry, and redirects to external payment form.
 * If the token is expired, returns a user-friendly Hebrew HTML page.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`payment-checkout:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Look up the request by payment_link_token
    // First look in event_requests (order-form-based events)
    const { data: reqRow } = await supabase
      .from('event_requests')
      .select('id, payment_status, payment_link_expires_at, total_price, event_name, contact_name')
      .eq('payment_link_token', token)
      .maybeSingle();

    // Fallback: look in events table (admin-created events store token there)
    let eventRowFallback = null;
    if (!reqRow) {
      const { data: evtCheck } = await supabase
        .from('events')
        .select('id, payment_status, payment_link_expires_at, name, client_name')
        .eq('payment_link_token', token)
        .maybeSingle();
      eventRowFallback = evtCheck;
    }

    if (!reqRow && !eventRowFallback) {
      logger.warn('[PAYMENT_CHECKOUT] Unknown token', { token: token.slice(0, 8) + '…' });
      return NextResponse.json({ error: 'Invalid or unknown payment link' }, { status: 404 });
    }

    // Normalise to a common shape for the rest of the handler
    const isEventBased = !reqRow && !!eventRowFallback;
    const request = reqRow ?? {
      id: eventRowFallback!.id,
      payment_status: (eventRowFallback!.payment_status === 'paid' ? 'paid'
        : eventRowFallback!.payment_status === 'waived' ? 'waived'
        : 'pending_payment') as string,
      payment_link_expires_at: eventRowFallback!.payment_link_expires_at,
      total_price: null as number | null,
      event_name: eventRowFallback!.name,
      contact_name: eventRowFallback!.client_name,
    };

    // Already paid?
    if (request.payment_status === 'paid') {
      return new NextResponse(buildHtmlPage(
        'התשלום כבר התקבל ✅',
        'תודה! התשלום עבור האירוע שלכם כבר התקבל. אין צורך בפעולה נוספת.',
      ), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Waived?
    if (request.payment_status === 'waived') {
      return new NextResponse(buildHtmlPage(
        'תשלום לא נדרש',
        'התשלום עבור האירוע שלכם בוטל. אין צורך בתשלום.',
      ), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Check expiry
    if (request.payment_link_expires_at) {
      const expiresAt = new Date(request.payment_link_expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired: clear token from whichever table stored it
        if (isEventBased) {
          await supabase
            .from('events')
            .update({ payment_link_token: null, payment_link_expires_at: null })
            .eq('id', request.id);
        } else {
          await supabase
            .from('event_requests')
            .update({ payment_status: 'expired' })
            .eq('id', request.id);
        }

        return new NextResponse(buildHtmlPage(
          'הקישור פג תוקף ⏰',
          'קישור התשלום פג תוקף. אנא צרו קשר איתנו לקבלת קישור חדש.',
        ), { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }

    // ── Stub mode ──
    if (!PAYMENT_PROVIDER_LIVE) {
      logger.info('[PAYMENT_CHECKOUT] Stub mode - checkout accessed', {
        requestId: request.id,
        totalPrice: request.total_price,
      });
      return NextResponse.json(
        {
          stub: true,
          message: 'Payment provider is in stub mode. Set PAYMENT_PROVIDER_LIVE=true to enable.',
          requestId: request.id,
          totalPrice: request.total_price,
          eventName: request.event_name,
        },
        { status: 501 },
      );
    }

    // ── Live mode: create clearing session and show payment page ──
    if (!isConfigured()) {
      logger.warn('[PAYMENT_CHECKOUT] Invoice4U not configured');
      return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });
    }

    // Calculate amount in shekel
    const totalShekel = request.total_price
      ? Math.round(request.total_price / 100)   // total_price is stored in agorot
      : BASE_PRICE;                              // fallback

    // Build callback URL
    const returnUrl = `${APP_BASE_URL}/api/payment/callback?rid=${request.id}`;

    // Create clearing session – direct charge (tokenisation not available)
    const description = request.event_name
      ? `Eventa - ${request.event_name}`
      : 'Eventa - חבילת אירוע';

    const result = await createClearingSession({
      fullName: request.contact_name || 'לקוח',
      phone: '',                             // phone not stored on lookup
      email: '',
      sum: totalShekel,
      description,
      orderId: request.id,
      returnUrl,
      tokenOnly: false,
      language: 'he',
    });

    if (!result.success || !result.data) {
      logger.error('[PAYMENT_CHECKOUT] Failed to create clearing session', { error: result.error });
      return new NextResponse(buildHtmlPage(
        'שגיאה',
        'לא ניתן ליצור מפגש תשלום. אנא נסו שוב מאוחר יותר או צרו קשר.',
      ), { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Save clearing IDs on the event request
    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({
        payment_status: 'awaiting_payment',
        clearing_log_id: result.data.clearingLogId,
        clearing_payment_id: result.data.paymentId,
        clearing_trace_id: result.data.clearingTraceId,
        invoice4u_customer_id: result.data.customerId,
      })
      .eq('id', request.id);

    if (updateErr) {
      logger.error('[PAYMENT_CHECKOUT] Failed to save clearing IDs', { error: updateErr.message });
    }

    // Redirect directly to the Cardcom payment page (no iframe)
    return NextResponse.redirect(result.data.clearingRedirectUrl, 303);
  } catch (err) {
    logger.error('[PAYMENT_CHECKOUT] Error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}

/**
 * Build a simple RTL Hebrew HTML page for payment status messages.
 */
function buildHtmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | Eventa</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 420px;
      text-align: center;
    }
    h1 { font-size: 1.5rem; margin: 0 0 1rem; }
    p { color: #a0a0a0; line-height: 1.6; margin: 0; }
    a {
      display: inline-block;
      margin-top: 1.5rem;
      color: #c084fc;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="https://eventa.productions">חזרה לאתר Eventa</a>
  </div>
</body>
</html>`;
}
