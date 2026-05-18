import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getServiceClient } from '@/lib/supabase';
import { createClearingSession, isConfigured } from '@/lib/invoice4u';
import {
  APP_BASE_URL,
  BASE_PRICE,
  PAYMENT_LINK_EXPIRY_DAYS,
  ORDER_NAME_MAX_LENGTH,
  ORDER_PHONE_MAX_LENGTH,
  ORDER_EMAIL_MAX_LENGTH,
} from '@/lib/config';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const sessionSchema = z.object({
  contactName: z.string().min(1).max(ORDER_NAME_MAX_LENGTH),
  contactPhone: z.string().min(1).max(ORDER_PHONE_MAX_LENGTH),
  contactEmail: z.string().max(ORDER_EMAIL_MAX_LENGTH).email().optional().or(z.literal('')),
  eventType: z.string().min(1).max(50),
  eventName: z.string().max(100).optional().default(''),
  startsAt: z.string().max(30),
  endsAt: z.string().max(30),
  wantsCustomBackground: z.boolean().optional().default(false),
  backgroundBase64: z.string().max(5_242_880).optional().nullable(),
  posterChoice: z.enum(['template', 'qr-only']).optional().default('qr-only'),
  selectedTemplateId: z.string().max(100).optional().nullable(),
  specialRequests: z.string().max(500).optional().default(''),
  wantsGuestMessages: z.boolean().optional().default(false),
});

/**
 * POST /api/payment/create-session
 *
 * Pay-now flow: saves a draft order + creates an Invoice4U clearing session.
 * Payment is collected during clearing. On success the callback auto-creates
 * the event and sends the approval email.
 */
export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`payment-session:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!isConfigured()) {
    logger.warn('[PAYMENT] Invoice4U not configured');
    return NextResponse.json({ error: 'Payment provider not configured', stub: true }, { status: 503 });
  }

  try {
    const body = await req.json();
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const d = parsed.data;
    const wantsMessages = d.wantsGuestMessages;
    const totalShekel = BASE_PRICE;
    const totalAgorot = totalShekel * 100;

    // ── Save draft order to event_requests ──
    const supabase = getServiceClient();
    const paymentLinkToken = crypto.randomUUID();
    const paymentLinkExpiresAt = new Date(
      Date.now() + PAYMENT_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: reqRow, error: dbErr } = await supabase
      .from('event_requests')
      .insert({
        event_type: d.eventType,
        event_name: d.eventName,
        starts_at: d.startsAt,
        ends_at: d.endsAt,
        wants_custom_background: d.wantsCustomBackground,
        background_base64: d.wantsCustomBackground ? d.backgroundBase64 : null,
        poster_choice: d.posterChoice,
        selected_template_id: d.selectedTemplateId || null,
        special_requests: d.specialRequests || null,
        wants_guest_messages: wantsMessages,
        contact_preference: 'pay-now',
        contact_name: d.contactName,
        contact_phone: d.contactPhone,
        contact_email: d.contactEmail,
        payment_status: 'awaiting_payment',
        total_price: totalAgorot,
        payment_link_token: paymentLinkToken,
        payment_link_expires_at: paymentLinkExpiresAt,
      })
      .select('id')
      .single();

    if (dbErr) {
      logger.error('[PAYMENT] Failed to save draft order', { error: dbErr.message });
      return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
    }

    const requestId = reqRow.id;

    // ── Create clearing session ──
    const returnUrl = `${APP_BASE_URL}/api/payment/callback?rid=${requestId}&src=wizard`;
    const cancelUrl = `${APP_BASE_URL}/order?payment=cancelled`;

    const description = wantsMessages
      ? `Eventa – חבילת אירוע + הודעות (₪${BASE_PRICE})`
      : `Eventa – חבילת אירוע (₪${BASE_PRICE})`;

    const result = await createClearingSession({
      fullName: d.contactName,
      phone: d.contactPhone,
      email: d.contactEmail || d.contactName,
      sum: totalShekel,
      description,
      orderId: requestId,
      returnUrl,
      cancelUrl,
      tokenOnly: false,
      language: 'he',
      skipDocument: true, // we create an itemised doc manually in the callback
    });

    if (!result.success || !result.data) {
      logger.error('[PAYMENT] Failed to create clearing session', { error: result.error });
      // Clean up the draft order
      await supabase.from('event_requests').delete().eq('id', requestId);
      return NextResponse.json({ error: 'Payment session creation failed' }, { status: 502 });
    }

    // Save clearing IDs on the draft order
    await supabase
      .from('event_requests')
      .update({
        clearing_log_id: result.data.clearingLogId,
        clearing_payment_id: result.data.paymentId,
        clearing_trace_id: result.data.clearingTraceId,
        invoice4u_customer_id: result.data.customerId,
      })
      .eq('id', requestId);

    logger.info('[PAYMENT] Clearing session created', { requestId, paymentId: result.data.paymentId });

    return NextResponse.json({
      success: true,
      paymentUrl: result.data.clearingRedirectUrl,
    });
  } catch (err) {
    logger.error('[PAYMENT] create-session error', err);
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
