import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { buildClientQrPageEmail } from '@/lib/email-templates';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';
import { decryptPii } from '@/lib/pii';

/** Max number of attachments per email. */
const MAX_FILES = 5;

/** MIME types we infer from the storage path extension. */
const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * POST /api/admin/events/[eventId]/send-qr-page
 *
 * Accepts JSON with storage paths (files already uploaded via qr-upload-url)
 * and sends the C8 "QR Page Ready" email to the event's client contact.
 *
 * Body (JSON): { storagePaths: string[] }
 *
 * Each file is downloaded from Supabase Storage and attached to the email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-send-qr-page', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    /* ── Parse request ── */
    const { storagePaths, qrOnly } = await req.json();

    if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
      return jsonError('נא לצרף לפחות קובץ אחד', 400);
    }
    if (storagePaths.length > MAX_FILES) {
      return jsonError(`מקסימום ${MAX_FILES} קבצים`, 400);
    }

    // Validate all paths belong to this event's qr-temp folder
    const prefix = `qr-temp/${eventId}/`;
    for (const p of storagePaths) {
      if (typeof p !== 'string' || !p.startsWith(prefix)) {
        return jsonError('Invalid storage path', 400);
      }
    }

    /* ── Load event + contact info ── */
    const supabase = getServiceClient();

    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, name, slug, client_name_enc, client_email_enc')
      .eq('id', eventId)
      .maybeSingle();

    if (evErr || !event) return jsonError('Event not found', 404);

    // Use client fields from event; fallback to event_requests for legacy events
    let contactName = decryptPii(event.client_name_enc, null);
    let contactEmail = decryptPii(event.client_email_enc, null);

    if (!contactEmail) {
      const { data: request } = await supabase
        .from('event_requests')
        .select('contact_name_enc, contact_email_enc')
        .eq('approved_event_id', eventId)
        .maybeSingle();

      contactName = decryptPii(request?.contact_name_enc, null) || null;
      contactEmail = decryptPii(request?.contact_email_enc, null) || null;
    }

    if (!contactEmail) {
      return jsonError('No contact email found for this event. Add client email in event settings.', 400);
    }

    /* ── Download files from storage ── */
    const attachments = await Promise.all(
      storagePaths.map(async (storagePath: string) => {
        const { data, error } = await supabase.storage
          .from('backgrounds')
          .download(storagePath);

        if (error || !data) {
          throw new Error(`Failed to download ${storagePath}: ${error?.message}`);
        }

        const ext = path.extname(storagePath).toLowerCase();
        const basename = path.basename(storagePath);
        // Strip the UUID prefix we added during upload (uuid-originalname)
        const filename = basename.replace(/^[0-9a-f-]{36,37}-/, '');

        return {
          filename,
          content: Buffer.from(await data.arrayBuffer()),
          contentType: EXT_TO_MIME[ext] || 'application/octet-stream',
        };
      })
    );

    /* ── Build email ── */
    const email = buildClientQrPageEmail({
      contactName: contactName ?? '',
      eventName: event.name,
      qrOnly: !!qrOnly,
    });

    /* ── Send email ── */
    await getMailTransporter().sendMail({
      from: getSmtpFrom(),
      to: contactEmail,
      subject: email.subject,
      html: email.html,
      attachments,
    });

    /* ── Clean up temp files ── */
    await supabase.storage.from('backgrounds').remove(storagePaths);

    /* ── Mark event as QR page sent ── */
    await supabase.from('events').update({ qr_page_sent: true }).eq('id', eventId);

    /* ── Log ── */
    await supabase.from('message_log').insert({
      event_id: eventId,
      channel: 'email',
      message_type: 'qr_page',
      recipient_email: contactEmail,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    adminAuditLog(
      'EMAIL_SENT',
      {
        eventId,
        type: 'qr_page',
        to: contactEmail,
        attachments: attachments.map((a) => a.filename),
      },
      req
    );

    return NextResponse.json({
      success: true,
      sentTo: contactEmail,
      attachments: attachments.map((a) => a.filename),
    });
  } catch (err) {
    logger.error('[ADMIN_SEND_QR_PAGE] error:', err);
    return jsonError('Failed to send QR page email', 500);
  }
}
