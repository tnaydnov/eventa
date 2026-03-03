import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { buildClientQrPageEmail } from '@/lib/email-templates';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SMTP_FROM = process.env.SMTP_FROM || 'noreply@eventa.productions';

/** Max total size of attachments: 15 MB */
const MAX_TOTAL_SIZE = 15 * 1024 * 1024;

/** Allowed MIME types for QR page attachments. */
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

/**
 * POST /api/admin/events/[eventId]/send-qr-page
 *
 * Accepts FormData with file attachments and sends the C8 "QR Page Ready"
 * email to the event's client contact.
 *
 * FormData fields:
 *   - files: one or more File entries (PDF, PNG, JPG)
 *
 * Each file is attached to the email as-is with its original filename.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-send-qr-page', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    /* ── Parse FormData ── */
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return jsonError('נא לצרף לפחות קובץ אחד', 400);
    }

    // Validate files
    let totalSize = 0;
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return jsonError(
          `סוג קובץ לא נתמך: ${file.name} (${file.type}). רק PDF, PNG, JPG, WebP.`,
          400
        );
      }
      totalSize += file.size;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return jsonError(
        `הקבצים גדולים מדי (${(totalSize / 1024 / 1024).toFixed(1)} MB). מקסימום 15 MB.`,
        400
      );
    }

    /* ── Load event + contact info ── */
    const supabase = getServiceClient();

    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, name, slug')
      .eq('id', eventId)
      .single();

    if (evErr || !event) return jsonError('Event not found', 404);

    const { data: request } = await supabase
      .from('event_requests')
      .select('contact_name, contact_email')
      .eq('approved_event_id', eventId)
      .single();

    if (!request?.contact_email) {
      return jsonError('No contact email found for this event', 400);
    }

    /* ── Build email ── */
    const email = buildClientQrPageEmail({
      contactName: request.contact_name,
      eventName: event.name,
    });

    /* ── Prepare attachments ── */
    const attachments = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
      }))
    );

    /* ── Send email ── */
    await transporter.sendMail({
      from: SMTP_FROM,
      to: request.contact_email,
      subject: email.subject,
      html: email.html,
      attachments,
    });

    /* ── Log ── */
    await supabase.from('message_log').insert({
      event_id: eventId,
      channel: 'email',
      message_type: 'qr_page',
      recipient_email: request.contact_email,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    adminAuditLog(
      'EMAIL_SENT',
      {
        eventId,
        type: 'qr_page',
        to: request.contact_email,
        attachments: files.map((f) => f.name),
      },
      req
    );

    return NextResponse.json({
      success: true,
      sentTo: request.contact_email,
      attachments: files.map((f) => f.name),
    });
  } catch (err) {
    logger.error('[ADMIN_SEND_QR_PAGE] error:', err);
    return jsonError('Failed to send QR page email', 500);
  }
}
