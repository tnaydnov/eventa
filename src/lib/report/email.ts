/**
 * Sends post-event report notification email to the event organizer.
 * Uses nodemailer with the shared SMTP transporter.
 */
import { logger } from '@/lib/logger';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';
import type { CuratedReportPayload } from './curate';
import { generateReportPdf, toReportPdfFilename } from './pdf';

const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.eventa.productions';

/** HTML email body for client report notification. */
function buildReportEmailHtml(
  eventName: string,
  portalUrl: string,
  payload: CuratedReportPayload
): string {
  const { engagement, network } = payload;
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:100%;">
      <!-- Header -->
      <tr><td dir="rtl" style="background:#0A0A0A;padding:28px 32px;text-align:center;">
        <img src="https://www.eventa.productions/icons/Eventa_Logo.png" alt="Eventa" height="36" />
      </td></tr>
      <!-- Body -->
      <tr><td dir="rtl" style="padding:32px;text-align:right;color:#1e1e1e;">
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">דוח האירוע שלך מוכן!</h2>
        <p style="margin:0 0 24px;font-size:16px;color:#6b6b6b;">הדוח המלא עבור האירוע <strong>${eventName}</strong> מוכן לצפייה.</p>
        <!-- Stats highlights -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td dir="rtl" style="text-align:right;padding:12px;background:#faf6f4;border-radius:8px;width:30%;">
              <div style="font-size:28px;font-weight:700;color:#b08d7e;">${network.total_participants}</div>
              <div style="font-size:13px;color:#6b6b6b;margin-top:4px;">משתתפים</div>
            </td>
            <td width="8"></td>
            <td dir="rtl" style="text-align:right;padding:12px;background:#faf6f4;border-radius:8px;width:30%;">
              <div style="font-size:28px;font-weight:700;color:#b08d7e;">${engagement.mutual_likes}</div>
              <div style="font-size:13px;color:#6b6b6b;margin-top:4px;">התאמות</div>
            </td>
            <td width="8"></td>
            <td dir="rtl" style="text-align:right;padding:12px;background:#faf6f4;border-radius:8px;width:30%;">
              <div style="font-size:28px;font-weight:700;color:#b08d7e;">${engagement.match_rate.toFixed(0)}%</div>
              <div style="font-size:13px;color:#6b6b6b;margin-top:4px;">אחוז התאמות</div>
            </td>
          </tr>
        </table>
        <!-- CTA -->
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr><td dir="rtl" style="text-align:right;">
            <a href="${portalUrl}" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:32px;font-size:16px;font-weight:600;">צפייה בדוח המלא</a>
          </td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#999;">הלינק תקף ל-30 יום. אם יש לך שאלות, אנחנו כאן.</p>
      </td></tr>
      <!-- Footer -->
      <tr><td dir="rtl" style="background:#f5f3f0;padding:20px 32px;text-align:center;border-top:1px solid #ece7e4;">
        <span style="font-size:12px;color:#999;">Eventa &copy; ${new Date().getFullYear()}</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export async function sendReportEmail(opts: {
  to: string;
  eventName: string;
  eventId: string;
  portalToken: string;
  payload: CuratedReportPayload;
  aiSummary?: string | null;
}): Promise<boolean> {
  const { to, eventName, eventId, portalToken, payload, aiSummary } = opts;
  const portalUrl = `${PORTAL_BASE_URL}/portal/${portalToken}`;

  try {
    const transporter = getMailTransporter();
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    try {
      const pdfBuffer = generateReportPdf({
        eventName,
        eventId,
        payload,
        aiSummary,
        portalUrl: `${portalUrl}/report`,
      });

      attachments = [{
        filename: toReportPdfFilename(eventName),
        content: pdfBuffer,
        contentType: 'application/pdf',
      }];
    } catch (pdfErr) {
      logger.error('[REPORT_EMAIL] pdf generation error, sending without attachment:', pdfErr);
    }

    await transporter.sendMail({
      from: getSmtpFrom(),
      to,
      subject: `הדוח עבור האירוע "${eventName}" מוכן`,
      html: buildReportEmailHtml(eventName, portalUrl, payload),
      attachments,
    });
    logger.info(`[REPORT_EMAIL] Sent report email for event ${eventId} to ${to}`);
    return true;
  } catch (err) {
    logger.error('[REPORT_EMAIL] send error:', err);
    return false;
  }
}
