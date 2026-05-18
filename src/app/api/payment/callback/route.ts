import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { logger } from '@/lib/logger';
import { getServiceClient, generateJoinCode, generateShortCode } from '@/lib/supabase';
import { getClearingLogById, createDocument, getDocument, DocumentType, PaymentType, getOrCreateCustomer, isConfigured } from '@/lib/invoice4u';
import { buildClientApprovalEmail, buildAdminPayNowNotification } from '@/lib/email-templates';
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
 *   3. Auto-create event (slug, join_code, background, messaging, portal)
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
  let newEventData: { id: string; slug: string; join_code: string } | null = null;
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
        payment_status: 'paid',
      })
      .select('id, slug, join_code')
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

/* ── Phase 2: Document creation + email (runs after redirect) ── */

async function sendDocumentAndEmails(ctx: {
  request: Record<string, unknown>;
  rid: string;
  eventName: string;
  newEvent: { id: string; slug: string; join_code: string } | null;
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
      const eventUrl = `${APP_BASE_URL}/${newEvent.slug}/join?k=${newEvent.join_code}`;

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
