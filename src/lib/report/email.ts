/**
 * Sends the post-event report to the event organizer.
 *
 * Uses the branded C7 "Event Summary" template (buildClientEventSummaryEmail) so the
 * email matches every other Eventa email, and attaches the one-page styled PDF report.
 * There is intentionally NO portal/report link in the email - everything the client needs
 * is inside the attached PDF (the client portal is only for guest-list uploads).
 */
import { logger } from '@/lib/logger';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';
import { buildClientEventSummaryEmail } from '@/lib/email-templates';
import type { CuratedReportPayload } from './curate';
import { generateReportPdf, toReportPdfFilename } from './pdf';

/** Sum the count for a gender label from the crosstab distribution. */
function genderCount(dist: { label: string; count: number }[] | undefined, label: string): number {
  if (!dist) return 0;
  return dist.filter((d) => d.label === label).reduce((a, d) => a + d.count, 0);
}

export async function sendReportEmail(opts: {
  to: string;
  eventName: string;
  eventId: string;
  payload: CuratedReportPayload;
  aiSummary?: string | null;
  /** Organizer name for the email greeting. */
  clientName?: string | null;
  /** Event date (ISO) for the email + PDF. */
  eventDate?: string | null;
}): Promise<boolean> {
  const { to, eventName, eventId, payload, aiSummary, clientName, eventDate } = opts;

  try {
    const transporter = getMailTransporter();

    // Build the one-page styled Hebrew PDF (defensive: never let a PDF error block the email).
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    try {
      const pdfBuffer = generateReportPdf({ eventName, eventId, payload, aiSummary, eventDate });
      attachments = [{
        filename: toReportPdfFilename(eventName),
        content: pdfBuffer,
        contentType: 'application/pdf',
      }];
    } catch (pdfErr) {
      logger.error('[REPORT_EMAIL] pdf generation error, sending without attachment:', pdfErr);
    }

    // Branded C7 template - stats mirror the admin "דוח לקוח" so the numbers are consistent.
    const { subject, html } = buildClientEventSummaryEmail({
      contactName: clientName || '',
      eventName,
      eventDate: eventDate || payload.generated_at,
      stats: {
        totalParticipants: payload.network.total_participants,
        men: genderCount(payload.crosstabs?.gender_distribution, 'male'),
        women: genderCount(payload.crosstabs?.gender_distribution, 'female'),
        totalMatches: payload.engagement.mutual_likes,
        totalConversations: payload.engagement.total_conversations,
      },
    });

    await transporter.sendMail({ from: getSmtpFrom(), to, subject, html, attachments });
    logger.info(`[REPORT_EMAIL] Sent report email for event ${eventId} to ${to}`);
    return true;
  } catch (err) {
    logger.error('[REPORT_EMAIL] send error:', err);
    return false;
  }
}
