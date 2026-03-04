import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient, generateJoinCode, generateShortCode } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { logger } from '@/lib/logger';
import { adminAuditLog } from '@/lib/admin-auth';
import { APP_BASE_URL, BASE_PRICE, MSG_ADDON } from '@/lib/config';
import {
  buildClientApprovalEmail,
  escapeHtml,
} from '@/lib/email-templates';
import { generatePrettySlug } from '@/lib/slug';
import { chargeWithToken } from '@/lib/invoice4u';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';

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
  const denied = adminGuard(req, 'admin-requests-post', RATE_LIMITS.standard);
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
      .maybeSingle();

    if (fetchErr || !request) {
      return jsonError('Request not found', 404);
    }

    if (request.status !== 'pending') {
      return jsonError('Request already processed', 400);
    }

    // ג”€ג”€ DENY ג”€ג”€
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

    // ג”€ג”€ APPROVE ג”€ג”€ Create the event automatically

    // ג”€ג”€ Charge credit card if card was captured via clearing ג”€ג”€
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
          docHeadline: `׳׳™׳¨׳•׳¢: ${request.event_name || request.event_type}`,
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

          return jsonError('Payment charge failed', 400);
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
        wa_messages_enabled: request.wants_guest_messages || false,
        client_name: request.contact_name || null,
        client_email: request.contact_email || null,
        client_phone: request.contact_phone || null,
        communication_preference: request.contact_preference || 'email',
      })
      .select('id, slug, join_code')
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

    // ג”€ג”€ Auto-actions for messaging addon ג”€ג”€
    let portalUrl: string | undefined;
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

        portalUrl = `${APP_BASE_URL}/guest-upload/${newEvent.slug}?k=${portalToken}`;
      } catch (msgErr) {
        // Non-fatal - event and approval already succeeded
        logger.warn('[ADMIN_REQUESTS] messaging auto-setup error:', msgErr);
      }
    }

    // ג”€ג”€ Defer email sending to run AFTER the response is returned ג”€ג”€
    // This prevents SMTP calls from causing 504 gateway timeouts.
    after(async () => {
      // Send C4 approval email to client
      if (request.contact_email) {
        try {
          const totalShekel = (BASE_PRICE + (request.wants_guest_messages ? MSG_ADDON : 0));
          const eventUrl = `${APP_BASE_URL}/dating/${newEvent.slug}/join?k=${newEvent.join_code}`;

          const approvalEmail = buildClientApprovalEmail({
            eventType: request.event_type,
            eventName: eventName,
            startsAt: request.starts_at,
            endsAt: request.ends_at,
            wantsCustomBackground: request.wants_custom_background || false,
            hasBgImage: !!request.wants_custom_background,
            posterChoice: request.poster_choice || '',
            selectedTemplate: request.selected_template_id || '',
            specialRequests: request.special_requests || '',
            wantsGuestMessages: request.wants_guest_messages || false,
            contactName: request.contact_name || '',
            totalPriceShekel: totalShekel,
            paymentMethod: chargeSucceeded ? 'credit_card' : (request.payment_method || 'bit'),
            eventUrl,
            portalUrl,
          });

          await getMailTransporter().sendMail({
            from: getSmtpFrom(),
            to: request.contact_email,
            subject: approvalEmail.subject,
            html: approvalEmail.html,
          });

          // Log to message_log
          const bgSupabase = getServiceClient();
          await bgSupabase.from('message_log').insert({
            event_id: newEvent.id,
            channel: 'email',
            message_type: 'approval',
            recipient_email: request.contact_email,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          logger.info('Auto-sent approval email (C4)', {
            eventId: newEvent.id,
            to: request.contact_email,
          });
        } catch (emailErr) {
          logger.warn('[ADMIN_REQUESTS] Failed to send approval email:', emailErr);
        }
      }

      // Send admin charge notification (if card was charged)
      if (chargeSucceeded) {
        try {
          const totalShekel = (BASE_PRICE + (request.wants_guest_messages ? MSG_ADDON : 0));
          const safeName = escapeHtml(request.contact_name || '');
          const safeEmail = escapeHtml(request.contact_email || '');
          const safeEvent = escapeHtml(eventName);

          const adminSubject = `׳—׳™׳•׳‘ ׳‘׳•׳¦׳¢ - ${eventName} (ג‚×${totalShekel})`;
          const adminHtml =
            `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"></head>` +
            `<body style="margin:0;padding:20px;background:#f5f3f0;font-family:Arial,sans-serif;">` +
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">` +
            `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;">` +
            `<tr><td dir="rtl" style="text-align:right;padding:24px;background:#e8f5e9;border-radius:12px 12px 0 0;">` +
            `<div style="font-size:16px;font-weight:700;color:#2e7d32;">׳—׳™׳•׳‘ ׳›׳¨׳˜׳™׳¡ ׳׳©׳¨׳׳™ ׳‘׳•׳¦׳¢ ׳‘׳”׳¦׳׳—׳”</div></td></tr>` +
            `<tr><td dir="rtl" style="text-align:right;padding:20px 24px;font-size:14px;color:#1e1e1e;line-height:1.7;">` +
            `<div><strong>׳׳§׳•׳—:</strong> ${safeName}</div>` +
            `<div><strong>׳׳™׳™׳:</strong> ${safeEmail}</div>` +
            `<div><strong>׳˜׳׳₪׳•׳:</strong> ${escapeHtml(request.contact_phone || '')}</div>` +
            `<div><strong>׳׳™׳¨׳•׳¢:</strong> ${safeEvent}</div>` +
            `<div><strong>׳¡׳›׳•׳:</strong> ג‚×${totalShekel}</div>` +
            `<div><strong>׳‘׳§׳©׳”:</strong> ${requestId}</div>` +
            `<div><strong>׳׳™׳¨׳•׳¢:</strong> ${newEvent.id}</div>` +
            `</td></tr></table></td></tr></table></body></html>`;

          await getMailTransporter().sendMail({
            from: getSmtpFrom(),
            to: 'contact@eventa.productions',
            subject: adminSubject,
            html: adminHtml,
          });

          logger.info('[ADMIN_REQUESTS] Admin charge notification sent', {
            requestId,
            eventId: newEvent.id,
          });
        } catch (emailErr) {
          logger.warn('[ADMIN_REQUESTS] Failed to send admin charge notification:', emailErr);
        }
      }
    });

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


/**
 * PATCH /api/admin/requests
 * Update payment status on a request.
 * Body: { requestId, action: 'mark_paid' | 'waive' | 'resend_link', paymentMethod?: string }
 */
export async function PATCH(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-patch', RATE_LIMITS.standard);
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
      .select('id, payment_status, contact_email, contact_name, event_type, event_name, starts_at, ends_at, wants_custom_background, poster_choice, selected_template_id, special_requests, wants_guest_messages, total_price, payment_link_token')
      .eq('id', requestId)
      .maybeSingle();

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
          const { buildClientPaymentLinkEmail } = await import('@/lib/email-templates');
          const baseUrl = APP_BASE_URL;
          const paymentEmail = buildClientPaymentLinkEmail({
            contactName: request.contact_name || '',
            eventType: request.event_type || '',
            eventName: request.event_name || '',
            startsAt: request.starts_at || '',
            endsAt: request.ends_at || '',
            wantsCustomBackground: request.wants_custom_background ?? false,
            hasBgImage: false,
            posterChoice: request.poster_choice || '',
            selectedTemplate: request.selected_template_id || '',
            specialRequests: request.special_requests || '',
            wantsGuestMessages: request.wants_guest_messages ?? true,
            paymentUrl: `${baseUrl}/api/payment/checkout?token=${newToken}`,
          });
          await getMailTransporter().sendMail({
            from: getSmtpFrom(),
            to: request.contact_email,
            subject: paymentEmail.subject,
            html: paymentEmail.html,
          });
          logger.info('[ADMIN_REQUESTS_PATCH] Payment link resent', { requestId, to: request.contact_email });
        } catch (emailErr) {
          logger.warn('[ADMIN_REQUESTS_PATCH] Failed to send payment email', {
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
          // Non-fatal - token was already updated
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

/**
 * DELETE /api/admin/requests
 * Delete a request.
 * - Approved/denied requests: only the request record is removed (event stays).
 * - Pending requests: the request AND its associated event (if any) are
 *   cascade-deleted, as if the request was never submitted.
 * Body: { requestId: string }
 */
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-delete', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const { requestId } = await req.json();
    if (!requestId || typeof requestId !== 'string') {
      return jsonError('Missing requestId', 400);
    }

    const supabase = getServiceClient();

    // Fetch the request
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('id, status, approved_event_id')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchErr || !request) {
      return jsonError('Request not found', 404);
    }

    const isPending = request.status === 'pending';
    const eventId = request.approved_event_id as string | null;

    // For pending requests with an associated event ג†’ cascade-delete the event
    if (isPending && eventId) {
      const warnings: string[] = [];

      const purge = async (table: string, filter: { col: string; val: string | string[]; op?: 'eq' | 'in' }) => {
        const query = supabase.from(table).delete();
        const q = filter.op === 'in'
          ? query.in(filter.col, filter.val as string[])
          : query.eq(filter.col, filter.val as string);
        const { error } = await q;
        if (error) {
          logger.error(`[ADMIN_REQUEST_DELETE] ${table} delete error:`, error.message);
          warnings.push(`${table}: ${error.message}`);
        }
      };

      // Participant photos ג†’ storage + DB
      const { data: parts } = await supabase.from('participants').select('id').eq('event_id', eventId);
      const pIds = (parts || []).map((p: { id: string }) => p.id);

      if (pIds.length > 0) {
        const { data: photos } = await supabase
          .from('participant_photos')
          .select('storage_path')
          .in('participant_id', pIds);
        if (photos && photos.length > 0) {
          await supabase.storage.from('photos').remove(photos.map((p: { storage_path: string }) => p.storage_path));
        }
        await purge('participant_photos', { col: 'participant_id', val: pIds, op: 'in' });
      }

      // Chat media + conversations
      const { data: convos } = await supabase.from('conversations').select('id').eq('event_id', eventId);
      const cIds = (convos || []).map((c: { id: string }) => c.id);
      if (cIds.length > 0) {
        const { data: chatMedia } = await supabase
          .from('messages')
          .select('media_path')
          .in('conversation_id', cIds)
          .not('media_path', 'is', null);
        if (chatMedia && chatMedia.length > 0) {
          await supabase.storage.from('photos').remove(chatMedia.map((m: { media_path: string }) => m.media_path));
        }
        await purge('messages', { col: 'conversation_id', val: cIds, op: 'in' });
      }
      await purge('conversations', { col: 'event_id', val: eventId });

      // Independent tables in parallel (includes ALL event-scoped tables)
      await Promise.all([
        purge('likes', { col: 'event_id', val: eventId }),
        purge('blocks', { col: 'event_id', val: eventId }),
        purge('banned_devices', { col: 'event_id', val: eventId }),
        purge('notifications', { col: 'event_id', val: eventId }),
        purge('activity_log', { col: 'event_id', val: eventId }),
        purge('event_analytics_snapshots', { col: 'event_id', val: eventId }),
        purge('client_portal_tokens', { col: 'event_id', val: eventId }),
        purge('otp_verifications', { col: 'event_id', val: eventId }),
        purge('event_guest_phones', { col: 'event_id', val: eventId }),
        purge('message_log', { col: 'event_id', val: eventId }),
      ]);

      // Participants
      await purge('participants', { col: 'event_id', val: eventId });

      // Background storage (best effort)
      await supabase.storage.from('backgrounds').remove(
        ['jpg', 'png', 'webp'].map(ext => `${eventId}/bg.${ext}`)
      );

      // Delete event row
      const { error: eventDelErr } = await supabase.from('events').delete().eq('id', eventId);
      if (eventDelErr) {
        logger.error('[ADMIN_REQUEST_DELETE] event delete error:', eventDelErr.message);
        return jsonError('Failed to delete associated event', 500);
      }

      evictEventStatusCache(eventId);
    }

    // Delete the request record
    const { error: reqDelErr } = await supabase.from('event_requests').delete().eq('id', requestId);
    if (reqDelErr) {
      logger.error('[ADMIN_REQUEST_DELETE] request delete error:', reqDelErr.message);
      return jsonError('Failed to delete request', 500);
    }

    adminAuditLog('REQUEST_DELETE', { requestId, status: request.status, eventDeleted: isPending && !!eventId }, req);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[ADMIN_REQUEST_DELETE] error:', err);
    return jsonError('Failed to delete request', 500);
  }
}
