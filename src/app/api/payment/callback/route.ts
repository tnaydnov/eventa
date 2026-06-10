import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { logger } from '@/lib/logger';
import { getServiceClient, generateShortCode } from '@/lib/supabase';
import { getClearingLogById, createDocument, getDocument, DocumentType, PaymentType, getOrCreateCustomer, isConfigured } from '@/lib/invoice4u';
import { buildClientApprovalEmail, buildAdminPayNowNotification, buildPaymentConfirmedEmail } from '@/lib/email-templates';
import { generatePrettySlug } from '@/lib/slug';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { APP_BASE_URL, BASE_PRICE } from '@/lib/config';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';

/**
 * GET /api/payment/callback?rid=<requestId>&src=wizard
 *
 * Invoice4U/Cardcom redirects here after the customer completes payment.
 *
 * Phase 1 (fast - before redirect):
 *   1. Verify payment via GetClearingLogById
 *   2. Mark order as paid
 *   3. Auto-create event (slug, background, messaging, portal)
 *
 * Phase 2 (after() - runs after the response is sent):
 *   4. Create itemised invoice-receipt via SOAP
 *   5. Fetch PDF receipt
 *   6. Send C4 approval email with receipt attached
 *   7. Send admin notification
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

  // ── Event-based payment (admin-created event, no event_requests row) ──
  const src = req.nextUrl.searchParams.get('src');
  if (src === 'event') {
    return handleEventPaymentCallback(rid, req);
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
  if (isConfigured() && request.clearing_log_id) {
    try {
      const logResult = await getClearingLogById(request.clearing_log_id);
      if (!logResult.success || !logResult.data?.isSuccess) {
        logger.warn('[PAYMENT_CALLBACK] Clearing log not successful', {
          rid,
          logId: request.clearing_log_id,
          error: logResult.error || logResult.data?.errorMessage,
        });
        // Cardcom only redirects here on success, so accept even if log check lags
      }
    } catch (err) {
      logger.error('[PAYMENT_CALLBACK] Failed to verify clearing log', err);
    }
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
  let newEventData: { id: string; slug: string } | null = null;
  let portalUrl: string | undefined;
  const eventName = request.event_name || `${request.event_type}-event`;

  try {
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
        payment_status: 'paid',
      })
      .select('id, slug')
      .single();

    if (createErr) {
      logger.error('[PAYMENT_CALLBACK] Event create error', { error: createErr.message });
      return redirectWithStatus('success');
    }

    newEventData = newEvent;

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

    // ── 5. Set up messaging + portal ──
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

        portalUrl = `${APP_BASE_URL}/portal/${portalToken}`;
      } catch (msgErr) {
        logger.warn('[PAYMENT_CALLBACK] messaging setup error (non-fatal)', msgErr);
      }
    }

    logger.info('[PAYMENT_CALLBACK] Event created', {
      rid,
      eventId: newEvent.id,
      slug: newEvent.slug,
    });
  } catch (eventErr) {
    logger.error('[PAYMENT_CALLBACK] Event creation failed', eventErr);
  }

  // ── Phase 2: Schedule slow work (document + emails) to run AFTER the response ──
  after(async () => {
    try {
      await sendDocumentAndEmails({
        request,
        rid,
        eventName,
        newEvent: newEventData,
        portalUrl,
      });
    } catch (err) {
      logger.error('[PAYMENT_CALLBACK_AFTER] Unhandled error in after()', err);
    }
  });

  return redirectWithStatus('success');
}

/* ── Event-based payment callback (admin-created events) ─────────────────── */

/**
 * Handles payment callbacks for admin-created events that store their
 * payment_link_token on the events table (no event_requests row).
 * Marks the event as paid, clears the token, creates a receipt, and
 * sends a C9 confirmation email.
 */
async function handleEventPaymentCallback(eventId: string, req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  logger.info('[PAYMENT_CALLBACK_EVENT] Processing event-based payment', { eventId, ip });

  const supabase = getServiceClient();

  // Load the event
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('id, name, slug, event_type, starts_at, ends_at, client_name, client_email, client_phone, payment_status')
    .eq('id', eventId)
    .maybeSingle();

  if (fetchErr || !event) {
    logger.warn('[PAYMENT_CALLBACK_EVENT] Event not found', { eventId });
    return redirectWithStatus('error');
  }

  // Already paid - idempotent
  if (event.payment_status === 'paid') {
    return redirectWithStatus('success');
  }

  // Mark event as paid + clear payment token
  await supabase
    .from('events')
    .update({
      payment_status: 'paid',
      payment_link_token: null,
      payment_link_expires_at: null,
    })
    .eq('id', eventId);

  logger.info('[PAYMENT_CALLBACK_EVENT] Event marked as paid', { eventId });

  // Schedule slow work (invoice + email) after response
  after(async () => {
    try {
      await sendEventPaymentEmails(event);
    } catch (err) {
      logger.error('[PAYMENT_CALLBACK_EVENT_AFTER] Unhandled error', err);
    }
  });

  return redirectWithStatus('success');
}

/**
 * Phase 2 for event-based payments: create invoice receipt and send C9 email.
 */
async function sendEventPaymentEmails(event: {
  id: string;
  name: string;
  slug: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
}): Promise<void> {
  if (!event.client_email) return;

  const supabase = getServiceClient();
  let pdfBuffer: Buffer | null = null;
  let pdfDocNumber = '';

  // ── Create invoice receipt ──
  try {
    const custResult = await getOrCreateCustomer({
      Name: event.client_name || 'לקוח Eventa',
      Phone: event.client_phone || undefined,
      Email: event.client_email,
    });

    const docResult = await createDocument({
      docType: DocumentType.InvoiceReceipt,
      customer: {
        ID: custResult.success ? custResult.data : undefined,
        Name: event.client_name || 'לקוח Eventa',
        Phone: event.client_phone || undefined,
        Email: event.client_email,
      },
      items: [{ Name: 'חבילת Eventa לאירוע', Price: BASE_PRICE, Quantity: 1 }],
      payments: [{ PaymentType: PaymentType.CreditCard, Amount: BASE_PRICE }],
      subject: `אירוע: ${event.name}`,
      sendByEmail: false,
    });

    if (docResult.success && docResult.data) {
      pdfDocNumber = docResult.data.DocumentNumber || '';
      let pdfUrl = docResult.data.DocumentURL;

      if (!pdfUrl && docResult.data.DocumentID) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const fetched = await getDocument(docResult.data.DocumentID);
        if (fetched.success && fetched.data?.DocumentURL) pdfUrl = fetched.data.DocumentURL;
      }

      if (pdfUrl) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(15_000) });
        if (pdfRes.ok) pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      }
    }
  } catch (pdfErr) {
    logger.warn('[PAYMENT_CALLBACK_EVENT_AFTER] Invoice creation error (non-fatal)', pdfErr);
  }

  // ── Send C9 payment confirmed email ──
  try {
    const eventUrl = `${APP_BASE_URL}/${event.slug}`;
    const email = buildPaymentConfirmedEmail({
      contactName: event.client_name || '',
      eventName: event.name,
      eventType: event.event_type,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      totalPriceShekel: BASE_PRICE,
      eventUrl,
    });

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
      to: event.client_email,
      subject: email.subject,
      html: email.html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    await supabase.from('message_log').insert({
      event_id: event.id,
      channel: 'email',
      message_type: 'payment_confirmed',
      recipient_email: event.client_email,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    logger.info('[PAYMENT_CALLBACK_EVENT_AFTER] Payment confirmed email sent', {
      eventId: event.id,
      hasPdf: !!pdfBuffer,
    });
  } catch (emailErr) {
    logger.warn('[PAYMENT_CALLBACK_EVENT_AFTER] Email send failed', emailErr);
  }
}

/* ── Phase 2: Document creation + email (runs after redirect) ── */

async function sendDocumentAndEmails(ctx: {
  request: Record<string, unknown>;
  rid: string;
  eventName: string;
  newEvent: { id: string; slug: string } | null;
  portalUrl?: string;
}) {
  const { request, rid, eventName, newEvent, portalUrl } = ctx;
  const supabase = getServiceClient();

  let pdfBuffer: Buffer | null = null;
  let pdfDocNumber = '';

  // ── Create itemised invoice-receipt ──
  try {
    const totalShekelDoc = BASE_PRICE;

    const items = [
      { Name: 'חבילת Eventa לאירוע', Price: BASE_PRICE, Quantity: 1 },
    ];

    const custResult = await getOrCreateCustomer({
      Name: (request.contact_name as string) || 'לקוח Eventa',
      Phone: (request.contact_phone as string) || undefined,
      Email: (request.contact_email as string) || undefined,
    });

    const docResult = await createDocument({
      docType: DocumentType.InvoiceReceipt,
      customer: {
        ID: custResult.success ? custResult.data : undefined,
        Name: (request.contact_name as string) || 'לקוח Eventa',
        Phone: (request.contact_phone as string) || undefined,
        Email: (request.contact_email as string) || undefined,
      },
      items,
      payments: [{
        PaymentType: PaymentType.CreditCard,
        Amount: totalShekelDoc,
      }],
      subject: `אירוע: ${(request.event_name as string) || (request.event_type as string) || 'אירוע'}`,
      sendByEmail: false,
    });

    if (docResult.success && docResult.data) {
      pdfDocNumber = docResult.data.DocumentNumber || '';
      let pdfUrl = docResult.data.DocumentURL;

      // If no PDF URL in CreateDocument response, wait and try GetDocument
      if (!pdfUrl && docResult.data.DocumentID) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const fetched = await getDocument(docResult.data.DocumentID);
        if (fetched.success && fetched.data?.DocumentURL) {
          pdfUrl = fetched.data.DocumentURL;
        }
      }

      if (pdfUrl) {
        // Small delay - Invoice4U may need a moment to generate the PDF
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(15_000) });
        if (pdfRes.ok) {
          const arrayBuf = await pdfRes.arrayBuffer();
          pdfBuffer = Buffer.from(arrayBuf);
        } else {
          logger.warn('[PAYMENT_CALLBACK_AFTER] PDF fetch non-ok', { status: pdfRes.status });
        }
      }

      logger.info('[PAYMENT_CALLBACK_AFTER] Document created', {
        docId: docResult.data.DocumentID,
        docNumber: pdfDocNumber,
        hasPdf: !!pdfBuffer,
        pdfUrl: pdfUrl || '(none)',
      });
    } else {
      logger.warn('[PAYMENT_CALLBACK_AFTER] createDocument failed', { error: docResult.error });
    }
  } catch (pdfErr) {
    logger.warn('[PAYMENT_CALLBACK_AFTER] Document creation error (non-fatal)', pdfErr);
  }

  // ── Send C4 approval email with receipt ──
  if (request.contact_email && newEvent) {
    try {
      const totalShekel = BASE_PRICE;
      const eventUrl = `${APP_BASE_URL}/${newEvent.slug}`;

      const approvalEmail = buildClientApprovalEmail({
        eventType: request.event_type as string,
        eventName: eventName,
        startsAt: request.starts_at as string,
        endsAt: request.ends_at as string,
        wantsCustomBackground: (request.wants_custom_background as boolean) || false,
        hasBgImage: !!(request.wants_custom_background as boolean),
        posterChoice: (request.poster_choice as string) || '',
        selectedTemplate: (request.selected_template_id as string) || '',
        specialRequests: (request.special_requests as string) || '',
        wantsGuestMessages: (request.wants_guest_messages as boolean) || false,
        contactName: (request.contact_name as string) || '',
        totalPriceShekel: totalShekel,
        paymentMethod: 'credit_card',
        eventUrl,
        portalUrl,
      });

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
        to: request.contact_email as string,
        subject: approvalEmail.subject,
        html: approvalEmail.html,
        ...(attachments.length > 0 ? { attachments } : {}),
      });

      await supabase.from('message_log').insert({
        event_id: newEvent.id,
        channel: 'email',
        message_type: 'approval',
        recipient_email: request.contact_email as string,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      logger.info('[PAYMENT_CALLBACK_AFTER] Approval email sent', {
        eventId: newEvent.id,
        hasPdf: !!pdfBuffer,
      });
    } catch (emailErr) {
      logger.warn('[PAYMENT_CALLBACK_AFTER] Failed to send approval email', emailErr);
    }
  }

  // ── Send admin notification (A1) ──
  try {
    const adminEmail = buildAdminPayNowNotification({
      eventType: request.event_type as string,
      eventName,
      startsAt: request.starts_at as string,
      endsAt: request.ends_at as string,
      wantsCustomBackground: (request.wants_custom_background as boolean) || false,
      hasBgImage: !!(request.wants_custom_background as boolean),
      posterChoice: (request.poster_choice as string) || '',
      selectedTemplate: (request.selected_template_id as string) || '',
      specialRequests: (request.special_requests as string) || '',
      wantsGuestMessages: (request.wants_guest_messages as boolean) || false,
      contactName: (request.contact_name as string) || '',
      contactPhone: (request.contact_phone as string) || '',
      contactEmail: (request.contact_email as string) || '',
      requestId: rid,
      eventSlug: newEvent?.slug,
      eventId: newEvent?.id,
    });

    await getMailTransporter().sendMail({
      from: getSmtpFrom(),
      to: 'contact@eventa.productions',
      subject: adminEmail.subject,
      html: adminEmail.html,
    });
  } catch (adminEmailErr) {
    logger.warn('[PAYMENT_CALLBACK_AFTER] Admin notification failed', adminEmailErr);
  }
}

/* ── Helpers ─────────────────────────────────────── */

function redirectWithStatus(status: 'success' | 'error' | 'cancelled') {
  return NextResponse.redirect(
    `${APP_BASE_URL}/order?payment=${status}`,
    303,
  );
}
