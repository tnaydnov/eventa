import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { adminSendEmailSchema } from '@/lib/validations';
import { APP_BASE_URL } from '@/lib/config';
import {
  buildUploadInstructionsEmail,
  buildUploadReminderEmail,
  buildMessagingAddonInvoiceEmail,
  buildEventSummaryEmail,
  buildCustomReminderEmail,
} from '@/lib/email-templates';

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

/**
 * POST /api/admin/events/[eventId]/send-email
 * Send an email of a given type to the event's client (contact_email).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-send-email', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const body = await req.json();
    const parsed = adminSendEmailSchema.safeParse(body);
    if (!parsed.success) return jsonError('Invalid input', 400);

    const supabase = getServiceClient();

    // Load event + event_request for contact info
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select(
        'id, name, slug, starts_at, ends_at, wa_messages_enabled, guest_list_count'
      )
      .eq('id', eventId)
      .single();

    if (evErr || !event) return jsonError('Event not found', 404);

    // Find the event_request to get contact info
    const { data: request } = await supabase
      .from('event_requests')
      .select('contact_name, contact_email, contact_phone')
      .eq('approved_event_id', eventId)
      .single();

    if (!request?.contact_email) {
      return jsonError('No contact email found for this event', 400);
    }

    const contactName = request.contact_name;
    const contactEmail = request.contact_email;

    // Build portal URL for upload-related emails
    const { data: tokenData } = await supabase
      .from('client_portal_tokens')
      .select('token')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .maybeSingle();

    const portalUrl = tokenData?.token
      ? `${APP_BASE_URL}/guest-upload/${event.slug}?k=${tokenData.token}`
      : null;
    const templateUrl = `${APP_BASE_URL}/templates/guest-upload-template.xlsx`;

    // Format event date/time for templates
    const eventDate = formatDate(event.starts_at);
    const eventTime = formatTime(event.starts_at);

    // Build email based on type
    let email: { subject: string; html: string };

    switch (parsed.data.type) {
      case 'upload_instructions': {
        if (!portalUrl) {
          return jsonError(
            'No active portal token — generate one first',
            400
          );
        }
        email = buildUploadInstructionsEmail({
          contactName,
          eventName: event.name,
          eventDate,
          eventTime,
          uploadUrl: portalUrl,
          templateUrl,
        });
        break;
      }

      case 'upload_reminder': {
        if (!portalUrl) {
          return jsonError(
            'No active portal token — generate one first',
            400
          );
        }
        email = buildUploadReminderEmail({
          contactName,
          eventName: event.name,
          eventDate,
          daysLeft: computeDaysUntil(event.starts_at),
          uploadUrl: portalUrl,
        });
        break;
      }

      case 'invoice': {
        // PayBox & Bit info — stubs for now (Section 27 future phase)
        const payboxUrl = `${APP_BASE_URL}/pay/${eventId}`;
        const bitPhone = process.env.BIT_PHONE || '050-0000000';
        email = buildMessagingAddonInvoiceEmail({
          contactName,
          eventName: event.name,
          payboxUrl,
          bitPhone,
        });
        break;
      }

      case 'summary': {
        // Gather stats for summary email
        const [participantsRes, logsRes] = await Promise.all([
          supabase
            .from('participants')
            .select('id, joined_via, feedback_sent, sms_consent')
            .eq('event_id', eventId),
          supabase
            .from('message_log')
            .select('id, message_type, status')
            .eq('event_id', eventId),
        ]);

        const parts = participantsRes.data || [];
        const logs = logsRes.data || [];

        const totalParticipants = parts.length;
        const fromPreEvent = parts.filter(
          (p: { joined_via: string }) => p.joined_via === 'whatsapp_link'
        ).length;
        const fromQr = totalParticipants - fromPreEvent;
        const totalMatches = 0; // Matches counted separately if needed
        const messagesDelivered = logs.filter(
          (l: { status: string }) => l.status === 'sent'
        ).length;
        const feedbackSent = parts.filter(
          (p: { feedback_sent: boolean }) => p.feedback_sent
        ).length;

        email = buildEventSummaryEmail({
          contactName,
          eventName: event.name,
          eventDate,
          stats: {
            totalParticipants,
            fromPreEvent,
            fromQr,
            totalMatches,
            messagesFromGuests: event.guest_list_count || 0,
            messagesDelivered,
            feedbackSent,
          },
        });
        break;
      }

      case 'custom': {
        if (!parsed.data.customMessage) {
          return jsonError(
            'Custom message is required for custom email type',
            400
          );
        }
        email = buildCustomReminderEmail({
          contactName,
          eventName: event.name,
          message: parsed.data.customMessage,
          uploadUrl: portalUrl || undefined,
        });
        break;
      }

      default:
        return jsonError('Unknown email type', 400);
    }

    // Send email
    await transporter.sendMail({
      from: SMTP_FROM,
      to: contactEmail,
      subject: email.subject,
      html: email.html,
    });

    // Log to message_log
    await supabase.from('message_log').insert({
      event_id: eventId,
      channel: 'email',
      message_type: parsed.data.type === 'custom' ? 'custom_reminder' : parsed.data.type,
      recipient_email: contactEmail,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    adminAuditLog(
      'EMAIL_SENT',
      { eventId, type: parsed.data.type, to: contactEmail },
      req
    );

    return NextResponse.json({ success: true, sentTo: contactEmail });
  } catch (err) {
    logger.error('[ADMIN_SEND_EMAIL] error:', err);
    return jsonError('Failed to send email', 500);
  }
}

// ─── Helpers ────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function computeDaysUntil(iso: string): number {
  const now = Date.now();
  const target = new Date(iso).getTime();
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
}
