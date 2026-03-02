import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient, generateJoinCode, generateShortCode } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { logger } from '@/lib/logger';
import { adminAuditLog } from '@/lib/admin-auth';
import { APP_BASE_URL, BASE_PRICE, MSG_ADDON } from '@/lib/config';
import {
  buildUploadInstructionsEmail,
  buildApprovalChargeEmail,
  buildAdminChargeNotificationEmail,
} from '@/lib/email-templates';
import { generatePrettySlug } from '@/lib/slug';
import { chargeWithToken, getClearingLogById } from '@/lib/invoice4u';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@eventa.productions';

/**
 * GET /api/admin/requests
 * List all event requests, ordered pending-first then by created_at desc.
 * Optionally filter by ?status=pending|approved|denied
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-get', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const supabase = getServiceClient();
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');

    let query = supabase
      .from('event_requests')
      .select('id, status, event_type, event_name, starts_at, ends_at, wants_custom_background, poster_choice, selected_template_id, special_requests, wants_guest_messages, contact_preference, contact_name, contact_phone, contact_email, admin_notes, approved_event_id, created_at, reviewed_at, payment_status, payment_method, paid_at, total_price, payment_link_token, payment_link_expires_at, clearing_log_id, clearing_payment_id, clearing_trace_id, invoice4u_customer_id')
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('[ADMIN_REQUESTS_GET] DB error:', error.message);
      return jsonError('Failed to load requests', 500);
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    logger.error('[ADMIN_REQUESTS_GET] error:', err);
    return jsonError('Failed to load requests', 500);
  }
}

/**
 * POST /api/admin/requests
 * Approve or deny a request.
 * Body: { requestId: string, action: 'approve' | 'deny', adminNotes?: string }
 *
 * On approve: creates a new event with all the data from the request.
 */
export async function POST(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-post', RATE_LIMITS.strict);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { requestId, action, adminNotes } = body;

    if (!requestId || !action || !['approve', 'deny'].includes(action)) {
      return jsonError('Invalid input', 400);
    }

    const supabase = getServiceClient();

    // Fetch the request
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return jsonError('Request not found', 404);
    }

    if (request.status !== 'pending') {
      return jsonError('Request already processed', 400);
    }

    // ── DENY ──
    if (action === 'deny') {
      const { error: updateErr } = await supabase
        .from('event_requests')
        .update({
          status: 'denied',
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) {
        logger.error('[ADMIN_REQUESTS] deny update error:', updateErr.message);
        return jsonError('Failed to deny request', 500);
      }

      adminAuditLog('REQUEST_DENY', { requestId }, req);
      return NextResponse.json({ success: true, action: 'denied' });
    }

    // ── APPROVE ── Create the event automatically

    // ── Charge credit card if card was captured via clearing ──
    let chargeSucceeded = false;
    const isCardCaptured = request.payment_status === 'card_captured';

    if (isCardCaptured) {
      // Require invoice4u_customer_id (the saved token / customer)
      if (!request.invoice4u_customer_id) {
        return jsonError('Card was captured but no customer ID found. Cannot charge.', 400);
      }

      try {
        const totalShekel = (BASE_PRICE + (request.wants_guest_messages ? MSG_ADDON : 0));

        const chargeResult = await chargeWithToken({
          customerId: request.invoice4u_customer_id,
          sum: totalShekel,
          description: `Eventa - ${request.event_name || request.event_type}`,
          createDocument: true,
          docHeadline: `אירוע: ${request.event_name || request.event_type}`,
        });

        if (!chargeResult.success) {
          // Update payment status to charge_failed
          await supabase
            .from('event_requests')
            .update({ payment_status: 'charge_failed' })
            .eq('id', requestId);

          logger.error('[ADMIN_REQUESTS] Charge failed', {
            requestId,
            error: chargeResult.error,
          });

          return jsonError(`Charge failed: ${chargeResult.error || 'Unknown error'}`, 400);
        }

        // Update payment status to paid
        await supabase
          .from('event_requests')
          .update({
            payment_status: 'paid',
            payment_method: 'credit_card',
            paid_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        chargeSucceeded = true;
        logger.info('[ADMIN_REQUESTS] Card charged successfully', { requestId });
      } catch (chargeErr) {
        await supabase
          .from('event_requests')
          .update({ payment_status: 'charge_failed' })
          .eq('id', requestId);

        logger.error('[ADMIN_REQUESTS] Charge error:', chargeErr);
        return jsonError('Failed to charge card. Payment status set to charge_failed.', 500);
      }
    }

    const eventName = request.event_name || `${request.event_type}-event`;

    // Generate pretty slug using the slug library
    const supabaseForSlug = getServiceClient();
    const slug = await generatePrettySlug(
      eventName,
      request.event_type,
      request.starts_at || new Date().toISOString(),
      supabaseForSlug,
    );

    // Create the event
    const { data: newEvent, error: createErr } = await supabase
      .from('events')
      .insert({
        name: eventName,
        slug,
        join_code: generateJoinCode(),
        event_type: request.event_type,
        status: 'active',
        description: request.special_requests || null,
        starts_at: request.starts_at,
        ends_at: request.ends_at,
        is_active: true,
      })
      .select('id, slug')
      .single();

    if (createErr) {
      logger.error('[ADMIN_REQUESTS] event create error:', createErr.message);
      return jsonError('Failed to create event', 500);
    }

    // If the request has a custom background image, upload it to storage
    if (request.wants_custom_background && request.background_base64) {
      try {
        const base64Data = (request.background_base64 as string).replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const storagePath = `${newEvent.id}/bg.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('backgrounds')
          .upload(storagePath, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadErr) {
          // Get public URL with cache-bust and update event
          const { data: urlData } = supabase.storage
            .from('backgrounds')
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            await supabase
              .from('events')
              .update({ background_image: `${urlData.publicUrl}?t=${Date.now()}` })
              .eq('id', newEvent.id);
          }
        } else {
          logger.warn('[ADMIN_REQUESTS] bg upload failed:', uploadErr.message);
        }
      } catch (bgErr) {
        logger.warn('[ADMIN_REQUESTS] bg processing error:', bgErr);
        // Non-fatal - event is still created
      }
    }

    // Update request as approved
    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({
        status: 'approved',
        admin_notes: adminNotes || null,
        approved_event_id: newEvent.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      logger.warn('[ADMIN_REQUESTS] approve update error:', updateErr.message);
      // Non-fatal - event was already created
    }

    adminAuditLog('REQUEST_APPROVE', { requestId, eventId: newEvent.id, slug }, req);
    logger.info('Event request approved', { requestId, eventId: newEvent.id });

    // ── Auto-actions for messaging addon ──
    if (request.wants_guest_messages) {
      try {
        // 5a. Enable WA messaging on the created event
        await supabase
          .from('events')
          .update({
            wa_messages_enabled: true,
            guest_list_uploaded: false,
            guest_list_count: 0,
          })
          .eq('id', newEvent.id);

        // 5b. Generate portal token (short code)
        const portalToken = generateShortCode(6);
        await supabase
          .from('client_portal_tokens')
          .insert({ event_id: newEvent.id, token: portalToken, is_active: true });

        // 5c. Send upload instructions email to client
        if (request.contact_email) {
          const eventDate = formatDate(request.starts_at);
          const eventTime = formatTime(request.starts_at);
          const portalUrl = `${APP_BASE_URL}/guest-upload/${newEvent.slug}?k=${portalToken}`;
          const templateUrl = `${APP_BASE_URL}/templates/guest-upload-template.xlsx`;

          const email = buildUploadInstructionsEmail({
            contactName: request.contact_name || '',
            eventName: eventName,
            eventDate,
            eventTime,
            uploadUrl: portalUrl,
            templateUrl,
          });

          await transporter.sendMail({
            from: SMTP_FROM,
            to: request.contact_email,
            subject: email.subject,
            html: email.html,
          });

          // Log to message_log
          await supabase.from('message_log').insert({
            event_id: newEvent.id,
            channel: 'email',
            message_type: 'upload_instructions',
            recipient_email: request.contact_email,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          logger.info('Auto-sent upload instructions on approval', {
            eventId: newEvent.id,
            to: request.contact_email,
          });
        }
      } catch (msgErr) {
        // Non-fatal — event and approval already succeeded
        logger.warn('[ADMIN_REQUESTS] messaging auto-setup error:', msgErr);
      }
    }

    // ── Auto-send emails for credit card charge flow ──
    if (chargeSucceeded && request.contact_email) {
      try {
        const totalShekel = (BASE_PRICE + (request.wants_guest_messages ? MSG_ADDON : 0));
        const eventDate = formatDate(request.starts_at);
        const eventUrl = `${APP_BASE_URL}/e/${newEvent.slug}`;

        // Send approval + charge email to client
        const approvalEmail = buildApprovalChargeEmail({
          contactName: request.contact_name || '',
          eventName,
          eventDate,
          totalPriceShekel: totalShekel,
          eventUrl,
        });

        await transporter.sendMail({
          from: SMTP_FROM,
          to: request.contact_email,
          subject: approvalEmail.subject,
          html: approvalEmail.html,
        });

        // Send admin notification about the charge
        const adminChargeEmail = buildAdminChargeNotificationEmail({
          contactName: request.contact_name || '',
          contactEmail: request.contact_email,
          contactPhone: request.contact_phone || '',
          eventName,
          totalPriceShekel: totalShekel,
          requestId,
          eventId: newEvent.id,
          eventSlug: newEvent.slug,
        });

        await transporter.sendMail({
          from: SMTP_FROM,
          to: 'contact@eventa.productions',
          subject: adminChargeEmail.subject,
          html: adminChargeEmail.html,
        });

        logger.info('[ADMIN_REQUESTS] Charge emails sent', {
          requestId,
          eventId: newEvent.id,
          clientEmail: request.contact_email,
        });
      } catch (emailErr) {
        // Non-fatal — charge and event creation already succeeded
        logger.warn('[ADMIN_REQUESTS] Failed to send charge emails:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      action: 'approved',
      event: newEvent,
    });
  } catch (err) {
    logger.error('[ADMIN_REQUESTS] error:', err);
    return jsonError('Failed to process request', 500);
  }
}

// ─── Helpers ────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('he-IL', {
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

/**
 * PATCH /api/admin/requests
 * Update payment status on a request.
 * Body: { requestId, action: 'mark_paid' | 'waive' | 'resend_link', paymentMethod?: string }
 */
export async function PATCH(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-patch', RATE_LIMITS.strict);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { requestId, action, paymentMethod } = body;

    if (!requestId || !action) {
      return jsonError('Missing requestId or action', 400);
    }

    const supabase = getServiceClient();
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('id, payment_status, contact_email, contact_name, event_name, total_price, payment_link_token')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return jsonError('Request not found', 404);
    }

    if (action === 'mark_paid') {
      const method = paymentMethod || 'other';
      const validMethods = ['bit', 'paybox', 'cash', 'bank_transfer', 'credit_card', 'other'];
      if (!validMethods.includes(method)) {
        return jsonError('Invalid payment method', 400);
      }

      const { error: updateErr } = await supabase
        .from('event_requests')
        .update({
          payment_status: 'paid',
          payment_method: method,
          paid_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) {
        logger.error('[ADMIN_REQUESTS_PATCH] mark_paid error:', updateErr.message);
        return jsonError('Failed to update payment status', 500);
      }

      adminAuditLog('PAYMENT_MARK_PAID', { requestId, method }, req);
      return NextResponse.json({ success: true, action: 'mark_paid' });
    }

    if (action === 'waive') {
      const { error: updateErr } = await supabase
        .from('event_requests')
        .update({ payment_status: 'waived' })
        .eq('id', requestId);

      if (updateErr) {
        logger.error('[ADMIN_REQUESTS_PATCH] waive error:', updateErr.message);
        return jsonError('Failed to waive payment', 500);
      }

      adminAuditLog('PAYMENT_WAIVE', { requestId }, req);
      return NextResponse.json({ success: true, action: 'waived' });
    }

    if (action === 'resend_link') {
      // Generate new token and extend expiry by 7 days
      const newToken = crypto.randomUUID();
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabase
        .from('event_requests')
        .update({
          payment_link_token: newToken,
          payment_link_expires_at: newExpiry,
          payment_status: 'payment_link_sent',
        })
        .eq('id', requestId);

      if (updateErr) {
        logger.error('[ADMIN_REQUESTS_PATCH] resend_link error:', updateErr.message);
        return jsonError('Failed to resend payment link', 500);
      }

      // Send the payment email to client
      if (request.contact_email) {
        try {
          const { buildClientPaymentEmail } = await import('@/lib/email-templates');
          const baseUrl = APP_BASE_URL;
          const paymentEmail = buildClientPaymentEmail({
            contactName: request.contact_name || '',
            contactEmail: request.contact_email,
            eventType: '',
            eventName: request.event_name || '',
            startsAt: '',
            endsAt: '',
            wantsCustomBackground: false,
            hasBgImage: false,
            posterChoice: '',
            selectedTemplate: '',
            specialRequests: '',
            wantsGuestMessages: true,
            requestId: request.id,
            baseUrl,
          });
          await transporter.sendMail({
            from: SMTP_FROM,
            to: request.contact_email,
            subject: paymentEmail.subject,
            html: paymentEmail.html,
          });
          logger.info('[ADMIN_REQUESTS_PATCH] Payment link resent', { requestId, to: request.contact_email });
        } catch (emailErr) {
          logger.warn('[ADMIN_REQUESTS_PATCH] Failed to send payment email', {
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
          // Non-fatal — token was already updated
        }
      }

      adminAuditLog('PAYMENT_RESEND_LINK', { requestId }, req);
      return NextResponse.json({ success: true, action: 'resend_link' });
    }

    return jsonError('Invalid action. Use: mark_paid, waive, resend_link', 400);
  } catch (err) {
    logger.error('[ADMIN_REQUESTS_PATCH] error:', err);
    return jsonError('Failed to update payment', 500);
  }
}
