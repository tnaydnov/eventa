import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getServiceClient } from '@/lib/supabase';
import { buildAdminContactOnlyNotification, escapeHtml } from '@/lib/email-templates';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';

/**
 * GET /api/order/contact-me?id=<requestId>
 *
 * Called when a client clicks "I want you to contact me" from the payment email.
 * Updates the request's contact_preference to 'call-me' and sends an email to admin.
 * Returns a simple HTML page confirming the action.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(`contact-me:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  const requestId = request.nextUrl.searchParams.get('id');
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return new NextResponse('Invalid request', { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Look up the request
    const { data: req, error } = await supabase
      .from('event_requests')
      .select('id, event_type, event_name, contact_name, contact_phone, contact_email, contact_preference')
      .eq('id', requestId)
      .maybeSingle();

    if (error || !req) {
      logger.warn('Contact-me: request not found', { requestId });
      return buildConfirmationPage('לא מצאנו את הבקשה', 'ייתכן שהקישור פג תוקף. פנו אלינו ישירות.');
    }

    // Update contact preference in DB
    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({ contact_preference: 'call-me' })
      .eq('id', requestId);
    if (updateErr) logger.error('[CONTACT_ME] Failed to update contact_preference', { requestId, error: updateErr.message });

    // Send notification email to admin
    const emailData = buildAdminContactOnlyNotification({
      contactName: req.contact_name,
      contactPhone: req.contact_phone,
      contactEmail: req.contact_email || '',
      message: `הלקוח ביקש ליצור קשר במקום לשלם.\nסוג אירוע: ${req.event_type}${req.event_name ? `\nשם אירוע: ${req.event_name}` : ''}\nמזהה בקשה: ${requestId}`,
    });

    try {
      await getMailTransporter().sendMail({
        from: getSmtpFrom(),
        to: 'contact@eventa.productions',
        subject: emailData.subject,
        html: emailData.html,
      });
    } catch (mailErr) {
      logger.error('[CONTACT_ME] Failed to send admin email', { requestId, error: mailErr instanceof Error ? mailErr.message : String(mailErr) });
    }

    logger.info('Contact-me-instead processed', { requestId });

    return buildConfirmationPage(
      'קיבלנו! נחזור אליכם בהקדם',
      `תודה ${req.contact_name}, צוות Eventa יצור איתכם קשר תוך 48 שעות.`
    );
  } catch (err) {
    logger.error('Contact-me error', { error: err instanceof Error ? err.message : String(err) });
    return buildConfirmationPage('שגיאה', 'משהו השתבש. פנו אלינו ישירות.');
  }
}

/** Build a simple branded confirmation HTML page. */
function buildConfirmationPage(title: string, message: string): NextResponse {
  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Eventa</title>
  <style>
    body { margin:0; background:#0a0a0a; font-family:'Segoe UI',Tahoma,Arial,sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; }
    .card { max-width:420px; text-align:center; padding:48px 32px; }
    .brand { font-size:28px; font-weight:700; color:#d4a59a; letter-spacing:2px; margin-bottom:32px; }
    .check { width:64px; height:64px; border-radius:50%; background:rgba(212,165,154,0.12); border:2px solid rgba(212,165,154,0.3); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
    .check svg { width:28px; height:28px; color:#d4a59a; }
    h1 { font-size:20px; color:#f0ede8; font-weight:600; margin:0 0 12px; }
    p { font-size:14px; color:#b0b0b0; line-height:1.6; margin:0; }
    a.back { display:inline-block; margin-top:24px; font-size:14px; color:#d4a59a; text-decoration:none; padding:10px 24px; border-radius:10px; border:1px solid rgba(212,165,154,0.3); }
    a.back:hover { background:rgba(212,165,154,0.06); }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">EVENTA</div>
    <div class="check">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a class="back" href="https://eventa.productions">חזרה לאתר</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
