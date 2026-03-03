import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { adminSendEmailSchema } from '@/lib/validations';
import { APP_BASE_URL, MSG_TIMING } from '@/lib/config';
import {
  buildClientUploadReminder7DayEmail,
  buildClientEventSummaryEmail,
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
  const denied = adminGuard(req, 'admin-send-email', RATE_LIMITS.standard);
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

    // Format event date for templates
    const eventDate = formatDate(event.starts_at);

    // Build email based on type
    let email: { subject: string; html: string };

    switch (parsed.data.type) {
      case 'upload_reminder': {
        if (!portalUrl) {
          return jsonError(
            'No active portal token - generate one first',
            400
          );
        }
        // Compute schedule times for the template
        const startsMs = new Date(event.starts_at).getTime();
        const preEventMs = MSG_TIMING.PRE_EVENT_HOURS_BEFORE * 60 * 60 * 1000;
        const messageSendAt = new Date(startsMs - preEventMs).toISOString();
        // Upload deadline = same as message send time (must upload before WA goes out)
        const uploadDeadline = messageSendAt;

        email = buildClientUploadReminder7DayEmail({
          contactName,
          eventName: event.name,
          daysLeft: computeDaysUntil(event.starts_at),
          uploadUrl: portalUrl,
          messageSendAt,
          uploadDeadline,
        });
        break;
      }

      case 'summary': {
        // Gather stats for summary email
        const [participantsRes, matchesRes, convoRes] = await Promise.all([
          supabase
            .from('participants')
            .select('id, gender')
            .eq('event_id', eventId),
          supabase
            .from('matches')
            .select('id')
            .eq('event_id', eventId),
          supabase
            .from('conversations')
            .select('id')
            .eq('event_id', eventId),
        ]);

        const parts = participantsRes.data || [];
        const totalParticipants = parts.length;
        const men = parts.filter(
          (p: { gender: string }) => p.gender === 'male'
        ).length;
        const women = parts.filter(
          (p: { gender: string }) => p.gender === 'female'
        ).length;
        const totalMatches = matchesRes.data?.length || 0;
        const totalConversations = convoRes.data?.length || 0;

        email = buildClientEventSummaryEmail({
          contactName,
          eventName: event.name,
          eventDate,
          stats: {
            totalParticipants,
            men,
            women,
            totalMatches,
            totalConversations,
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
        const safeName = contactName.replace(/</g, '&lt;');
        const safeEvent = event.name.replace(/</g, '&lt;');
        const safeMsg = parsed.data.customMessage.replace(/</g, '&lt;');
        email = {
          subject: `Eventa - ${event.name}`,
          html: `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Eventa</title></head>` +
            `<body style="margin:0;padding:20px;background:#f5f3f0;font-family:Arial,Helvetica,sans-serif;">` +
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">` +
            `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);">` +
            `<tr><td dir="rtl" style="text-align:right;padding:32px;font-size:15px;color:#1e1e1e;line-height:1.7;">` +
            `<div style="font-weight:600;margin-bottom:8px;">שלום ${safeName},</div>` +
            `<div style="color:#6b6b6b;margin-bottom:16px;">בנוגע לאירוע <strong>${safeEvent}</strong>:</div>` +
            `<div style="background:#faf6f4;border-right:3px solid #b08d7e;border-radius:6px;padding:16px 18px;font-size:15px;color:#1e1e1e;line-height:1.8;white-space:pre-line;">${safeMsg}</div>` +
            `</td></tr></table></td></tr></table></body></html>`,
        };
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

function computeDaysUntil(iso: string): number {
  const now = Date.now();
  const target = new Date(iso).getTime();
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
}
