import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getServiceClient } from '@/lib/supabase';
import {
  ORDER_NAME_MAX_LENGTH,
  ORDER_PHONE_MAX_LENGTH,
  ORDER_EMAIL_MAX_LENGTH,
  calculateTotalPrice,
  PAYMENT_LINK_EXPIRY_DAYS,
  BASE_PRICE,
  MSG_ADDON,
} from '@/lib/config';
import {
  buildAdminNotificationEmail,
  buildClientPaymentEmail,
  buildCardCapturedEmail,
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

/** Zod schema for order form - validates and sanitizes all inputs. */
const orderSchema = z.object({
  eventType: z.string().min(1).max(50),
  eventDate: z.string().min(1).max(20),
  contactName: z.string().min(1).max(ORDER_NAME_MAX_LENGTH),
  contactPhone: z.string().min(1).max(ORDER_PHONE_MAX_LENGTH)
    .regex(/^[\d\s+\-()]+$/, 'Invalid phone format'),
  contactEmail: z.string().max(ORDER_EMAIL_MAX_LENGTH).email().optional()
    .or(z.literal('')),
  // Extended wizard fields (optional - absent for simple OrderForm submissions)
  source: z.enum(['wizard', 'form']).optional(),
  eventName: z.string().max(100).optional(),
  startsAt: z.string().max(30).optional(),
  endsAt: z.string().max(30).optional(),
  wantsCustomBackground: z.boolean().optional(),
  backgroundBase64: z.string().optional().nullable(),
  posterChoice: z.enum(['template', 'qr-only']).optional(),
  selectedTemplateId: z.string().max(100).optional().nullable(),
  specialRequests: z.string().max(500).optional(),
  wantsGuestMessages: z.boolean().optional(),
  contactPreference: z.enum(['call-me', 'send-link', 'pay-now']).optional(),
});

/**
 * POST /api/order
 * Receives a new order form submission:
 *  1. Saves to `event_requests` table (pending admin approval)
 *  2. Sends a professional notification email to admin
 *  3. If client chose "send-link" → sends payment email to client
 *
 * Protected by CSRF + rate limiting (no session required - public form).
 */
export async function POST(request: NextRequest) {
  // CSRF check (defense-in-depth for public forms)
  if (!checkCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit by IP - use strict config (3/min) to prevent spam
  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(`order:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    logger.warn('Order form rate limited', { ip });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { eventType, contactName, contactPhone, contactEmail } = parsed.data;

    // Extended wizard fields (may be undefined for simple form submissions)
    const isWizard = parsed.data.source === 'wizard';
    const eventName = parsed.data.eventName || '';
    const startsAt = parsed.data.startsAt || '';
    const endsAt = parsed.data.endsAt || '';
    const wantsCustomBg = parsed.data.wantsCustomBackground ?? false;
    const posterChoice = parsed.data.posterChoice || 'qr-only';
    const selectedTemplate = parsed.data.selectedTemplateId || '';
    const specialReqs = parsed.data.specialRequests || '';
    const wantsMessages = parsed.data.wantsGuestMessages ?? false;
    const contactPref = parsed.data.contactPreference || 'call-me';
    const hasBgImage = wantsCustomBg && !!parsed.data.backgroundBase64;

    // ── 1. Save to event_requests table ──
    let requestId = '';
    let paymentLinkToken = '';
    if (isWizard) {
      const supabase = getServiceClient();

      // Generate payment link token and calculate price
      paymentLinkToken = crypto.randomUUID();
      const totalPrice = calculateTotalPrice(wantsMessages);
      const paymentLinkExpiresAt = new Date(
        Date.now() + PAYMENT_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      // Determine initial payment status based on contact preference
      let paymentStatus: string;
      if (contactPref === 'pay-now') {
        paymentStatus = 'awaiting_payment';
      } else if (contactPref === 'send-link') {
        paymentStatus = 'payment_link_sent';
      } else {
        paymentStatus = 'pending_payment';
      }

      const { data: reqRow, error: dbErr } = await supabase
        .from('event_requests')
        .insert({
          event_type: eventType,
          event_name: eventName,
          starts_at: startsAt || new Date().toISOString(),
          ends_at: endsAt || new Date(Date.now() + 86_400_000).toISOString(),
          wants_custom_background: wantsCustomBg,
          background_base64: hasBgImage ? parsed.data.backgroundBase64 : null,
          poster_choice: posterChoice,
          selected_template_id: selectedTemplate || null,
          special_requests: specialReqs || null,
          wants_guest_messages: wantsMessages,
          contact_preference: contactPref,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_email: contactEmail || null,
          // Payment fields
          payment_status: paymentStatus,
          total_price: totalPrice,
          payment_link_token: paymentLinkToken,
          payment_link_expires_at: paymentLinkExpiresAt,
        })
        .select('id')
        .single();

      if (dbErr) {
        logger.error('Failed to save event request to DB', { error: dbErr.message });
        // Continue even if DB save fails - email is still important
      } else {
        requestId = reqRow.id;
      }
    }

    // ── 2. Build & send admin notification email ──
    const orderData = {
      eventType,
      eventName,
      startsAt,
      endsAt,
      contactName,
      contactPhone,
      contactEmail: contactEmail || '',
      wantsCustomBackground: wantsCustomBg,
      hasBgImage,
      posterChoice,
      selectedTemplate,
      specialRequests: specialReqs,
      wantsGuestMessages: wantsMessages,
      contactPreference: contactPref,
      isWizard,
    };

    const adminEmail = buildAdminNotificationEmail(orderData);

    // If wizard submission includes a background image, attach it
    const attachments: Array<{ filename: string; content: Buffer; cid: string }> = [];
    if (hasBgImage && parsed.data.backgroundBase64) {
      const base64Data = parsed.data.backgroundBase64.replace(/^data:image\/\w+;base64,/, '');
      attachments.push({
        filename: 'background.jpg',
        content: Buffer.from(base64Data, 'base64'),
        cid: 'bg-image',
      });
    }

    await transporter.sendMail({
      from: `"Eventa" <${process.env.SMTP_USER}>`,
      to: 'contact@eventa.productions',
      subject: adminEmail.subject,
      html: adminEmail.html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    // ── 3. If client chose "send-link" and has email → send payment email (legacy flow) ──
    if (isWizard && contactPref === 'send-link' && contactEmail && requestId) {
      try {
        const baseUrl = `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host') || 'eventa.productions'}`;
        const paymentEmail = buildClientPaymentEmail({
          contactName,
          contactEmail,
          eventType,
          eventName,
          startsAt,
          endsAt,
          wantsCustomBackground: wantsCustomBg,
          hasBgImage,
          posterChoice,
          selectedTemplate,
          specialRequests: specialReqs,
          wantsGuestMessages: wantsMessages,
          requestId,
          baseUrl,
        });

        await transporter.sendMail({
          from: `"Eventa" <${process.env.SMTP_USER}>`,
          to: contactEmail,
          subject: paymentEmail.subject,
          html: paymentEmail.html,
        });

        logger.info('Payment email sent to client', { contactEmail, requestId });
      } catch (emailErr) {
        // Don't fail the whole request if client email fails
        logger.error('Failed to send payment email', {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      }
    }

    // ── 4. For pay-now flow, return requestId so frontend can create clearing session ──
    const totalShekel = (BASE_PRICE + (wantsMessages ? MSG_ADDON : 0));
    const responseData: Record<string, unknown> = { success: true };

    if (isWizard && contactPref === 'pay-now' && requestId) {
      responseData.requestId = requestId;
      responseData.totalPriceShekel = totalShekel;
      responseData.payNow = true;
    }

    logger.info('Order processed', {
      eventType,
      contactName,
      source: isWizard ? 'wizard' : 'form',
      requestId: requestId || 'n/a',
      contactPref,
    });
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('Order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to send order' }, { status: 500 });
  }
}
