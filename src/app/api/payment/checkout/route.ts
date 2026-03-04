import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

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
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('id, payment_status, payment_link_expires_at, total_price, event_name, contact_name')
      .eq('payment_link_token', token)
      .maybeSingle();

    if (fetchErr || !request) {
      logger.warn('[PAYMENT_CHECKOUT] Unknown token', { token });
      return NextResponse.json({ error: 'Invalid or unknown payment link' }, { status: 404 });
    }

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
        // Mark as expired in DB
        await supabase
          .from('event_requests')
          .update({ payment_status: 'expired' })
          .eq('id', request.id);

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

    // ── Live mode: redirect to payment provider ──
    // TODO: Build payment provider redirect URL with token, amount, callback
    // For now, return a placeholder
    return NextResponse.json({
      message: 'Redirect to payment provider would happen here',
      requestId: request.id,
      totalPrice: request.total_price,
    });
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
  <title>${title} | Eventa</title>
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
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://eventa.productions">חזרה לאתר Eventa</a>
  </div>
</body>
</html>`;
}
