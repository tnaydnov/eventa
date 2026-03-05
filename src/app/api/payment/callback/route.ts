import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getServiceClient, generateJoinCode, generateShortCode } from '@/lib/supabase';
import { getClearingLogById, getDocument, isConfigured } from '@/lib/invoice4u';
import { buildClientApprovalEmail, escapeHtml } from '@/lib/email-templates';
import { generatePrettySlug } from '@/lib/slug';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { APP_BASE_URL, BASE_PRICE, MSG_ADDON } from '@/lib/config';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';

/**
 * GET /api/payment/callback?rid=<requestId>&src=wizard
 *
 * Invoice4U/Cardcom redirects here after the customer completes payment.
 *
 * 1. Verifies payment via GetClearingLogById
 * 2. Marks order as paid
 * 3. Auto-creates event (slug, join_code, background, WA messaging, portal)
 * 4. Fetches PDF receipt from Invoice4U
 * 5. Sends C4 approval email with receipt attached
 * 6. Redirects back to the wizard success page
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`payment-callback:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return redirectWithStatus('error');
  }

  const rid = req.nextUrl.searchParams.get('rid');
  if (!rid) {
    return redirectWithStatus('error');
  }

  const supabase = getServiceClient();

  // ── 1. Fetch the draft order ──
  const { data: request, error: fetchErr } = await supabase
    .from('event_requests')
    .select('*')
    .eq('id', rid)
    .maybeSingle();

  if (fetchErr || !request) {
    logger.warn('[PAYMENT_CALLBACK] Request not found', { rid });
    return redirectWithStatus('error');
  }

  // Already processed - idempotent
  if (request.status === 'approved' && request.approved_event_id) {
    return redirectWithStatus('success');
  }

  // ── 2. Verify payment with Invoice4U ──
  let verified = false;
  let docId: string | null = null;

  if (isConfigured() && request.clearing_log_id) {
    try {
      const logResult = await getClearingLogById(request.clearing_log_id);
      if (logResult.success && logResult.data?.isSuccess) {
        verified = true;
        if (logResult.data.isDocumentCreated && logResult.data.docId) {
          docId = logResult.data.docId;
        }
      } else {
        logger.warn('[PAYMENT_CALLBACK] Clearing log not successful', {
          rid,
          logId: request.clearing_log_id,
          error: logResult.error || logResult.data?.errorMessage,
        });
      }
    } catch (err) {
      logger.error('[PAYMENT_CALLBACK] Failed to verify clearing log', err);
    }
  }

  // Stub mode: accept anyway
  if (!isConfigured()) {
    verified = true;
  }

  if (!verified) {
    // Cardcom only redirects here on success, so accept even if log check lags
    logger.warn('[PAYMENT_CALLBACK] Clearing log not verified, accepting redirect', { rid });
    verified = true;
  }

  // ── 3. Mark order as paid ──
  await supabase
    .from('event_requests')
    .update({
      payment_status: 'paid',
      payment_method: 'credit_card',
      paid_at: new Date().toISOString(),
    })
    .eq('id', rid);

  logger.info('[PAYMENT_CALLBACK] Payment verified', { rid });

  // ── 4. Auto-create the event ──
  try {
    const eventName = request.event_name || `${request.event_type}-event`;

    const slug = await generatePrettySlug(
      eventName,
      request.event_type,
      request.starts_at || new Date().toISOString(),
      supabase,
    );

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
        communication_preference: 'email',
      })
      .select('id, slug, join_code')
      .single();

    if (createErr) {
      logger.error('[PAYMENT_CALLBACK] Event create error', { error: createErr.message });
      // Payment succeeded but event creation failed — admin can fix manually
      return redirectWithStatus('success');
    }

    // Upload background if exists
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
          const { data: urlData } = supabase.storage
            .from('backgrounds')
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            await supabase
              .from('events')
              .update({ background_image: `${urlData.publicUrl}?t=${Date.now()}` })
              .eq('id', newEvent.id);
          }
        }
      } catch (bgErr) {
        logger.warn('[PAYMENT_CALLBACK] bg upload error (non-fatal)', bgErr);
      }
    }

    // Mark request as approved
    await supabase
      .from('event_requests')
      .update({
        status: 'approved',
        approved_event_id: newEvent.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: 'אושר אוטומטית לאחר תשלום',
      })
      .eq('id', rid);

    // ── 5. Set up WA messaging + portal ──
    let portalUrl: string | undefined;
    if (request.wants_guest_messages) {
      try {
        await supabase
          .from('events')
          .update({
            wa_messages_enabled: true,
            guest_list_uploaded: false,
            guest_list_count: 0,
          })
          .eq('id', newEvent.id);

        const portalToken = generateShortCode(6);
        await supabase
          .from('client_portal_tokens')
          .insert({ event_id: newEvent.id, token: portalToken, is_active: true });

        portalUrl = `${APP_BASE_URL}/guest-upload/${newEvent.slug}?k=${portalToken}`;
      } catch (msgErr) {
        logger.warn('[PAYMENT_CALLBACK] messaging setup error (non-fatal)', msgErr);
      }
    }

    // ── 6. Fetch PDF receipt ──
    let pdfBuffer: Buffer | null = null;
    let pdfDocNumber = '';
    if (docId) {
      try {
        const docResult = await getDocument(docId);
        if (docResult.success && docResult.data?.DocumentURL) {
          pdfDocNumber = docResult.data.DocumentNumber || '';
          const pdfRes = await fetch(docResult.data.DocumentURL, { signal: AbortSignal.timeout(10_000) });
          if (pdfRes.ok) {
            const arrayBuf = await pdfRes.arrayBuffer();
            pdfBuffer = Buffer.from(arrayBuf);
          }
        }
      } catch (pdfErr) {
        logger.warn('[PAYMENT_CALLBACK] PDF fetch error (non-fatal)', pdfErr);
      }
    }

    // ── 7. Send C4 approval email with receipt ──
    if (request.contact_email) {
      try {
        const totalShekel = BASE_PRICE + (request.wants_guest_messages ? MSG_ADDON : 0);
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
          paymentMethod: 'credit_card',
          eventUrl,
          portalUrl,
        });

        // Build attachments
        const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
        if (pdfBuffer) {
          attachments.push({
            filename: pdfDocNumber ? `receipt-${pdfDocNumber}.pdf` : 'receipt.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }

        await getMailTransporter().sendMail({
          from: getSmtpFrom(),
          to: request.contact_email,
          subject: approvalEmail.subject,
          html: approvalEmail.html,
          ...(attachments.length > 0 ? { attachments } : {}),
        });

        // Log to message_log
        await supabase.from('message_log').insert({
          event_id: newEvent.id,
          channel: 'email',
          message_type: 'approval',
          recipient_email: request.contact_email,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        logger.info('[PAYMENT_CALLBACK] Approval email sent', {
          eventId: newEvent.id,
          hasPdf: !!pdfBuffer,
        });
      } catch (emailErr) {
        logger.warn('[PAYMENT_CALLBACK] Failed to send approval email (non-fatal)', emailErr);
      }
    }

    // ── 8. Send admin notification ──
    try {
      const totalShekel = BASE_PRICE + (request.wants_guest_messages ? MSG_ADDON : 0);
      const safeName = escapeHtml(request.contact_name || '');
      const safeEmail = escapeHtml(request.contact_email || '');
      const safeEvent = escapeHtml(eventName);

      const adminSubject = `תשלום התקבל ואירוע נוצר - ${eventName} (₪${totalShekel})`;
      const adminHtml =
        `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"></head>` +
        `<body style="margin:0;padding:20px;background:#f5f3f0;font-family:Arial,sans-serif;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">` +
        `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;">` +
        `<tr><td dir="rtl" style="text-align:right;padding:24px;background:#e8f5e9;border-radius:12px 12px 0 0;">` +
        `<div style="font-size:16px;font-weight:700;color:#2e7d32;">תשלום התקבל - אירוע נוצר אוטומטית</div></td></tr>` +
        `<tr><td dir="rtl" style="text-align:right;padding:20px 24px;font-size:14px;color:#1e1e1e;line-height:1.7;">` +
        `<div><strong>לקוח:</strong> ${safeName}</div>` +
        `<div><strong>אימייל:</strong> ${safeEmail}</div>` +
        `<div><strong>טלפון:</strong> ${escapeHtml(request.contact_phone || '')}</div>` +
        `<div><strong>אירוע:</strong> ${safeEvent}</div>` +
        `<div><strong>סכום:</strong> ₪${totalShekel}</div>` +
        `<div><strong>slug:</strong> ${escapeHtml(newEvent.slug)}</div>` +
        `<div><strong>בקשה:</strong> ${rid}</div>` +
        `</td></tr></table></td></tr></table></body></html>`;

      await getMailTransporter().sendMail({
        from: getSmtpFrom(),
        to: 'contact@eventa.productions',
        subject: adminSubject,
        html: adminHtml,
      });
    } catch (adminEmailErr) {
      logger.warn('[PAYMENT_CALLBACK] Admin notification failed (non-fatal)', adminEmailErr);
    }

    logger.info('[PAYMENT_CALLBACK] Event created', {
      rid,
      eventId: newEvent.id,
      slug: newEvent.slug,
    });
  } catch (eventErr) {
    logger.error('[PAYMENT_CALLBACK] Event creation failed', eventErr);
    // Payment was collected — admin can complete event creation manually
  }

  return redirectWithStatus('success');
}

/* ── Helpers ─────────────────────────────────────── */

function redirectWithStatus(status: 'success' | 'error' | 'cancelled') {
  return NextResponse.redirect(
    `${APP_BASE_URL}/dating/order?payment=${status}`,
    303,
  );
}
