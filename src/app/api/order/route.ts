import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import {
  ORDER_NAME_MAX_LENGTH,
  ORDER_PHONE_MAX_LENGTH,
  ORDER_EMAIL_MAX_LENGTH,
} from '@/lib/config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** Escape HTML special characters to prevent injection in email template. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Zod schema for order form - validates and sanitizes all inputs. */
const orderSchema = z.object({
  eventType: z.string().min(1).max(50),
  eventDate: z.string().min(1).max(20),
  contactName: z.string().min(1).max(ORDER_NAME_MAX_LENGTH),
  contactPhone: z.string().min(1).max(ORDER_PHONE_MAX_LENGTH)
    .regex(/^[\d\s+\-()]+$/, 'Invalid phone format'),
  contactEmail: z.string().max(ORDER_EMAIL_MAX_LENGTH).email().optional()
    .or(z.literal('')),
  // Extended wizard fields (optional — absent for simple OrderForm submissions)
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
  contactPreference: z.enum(['call-me', 'send-link']).optional(),
});

/**
 * POST /api/order
 * Receives a new order form submission and sends an email notification.
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

    const { eventType, eventDate, contactName, contactPhone, contactEmail } = parsed.data;

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

    // Escape ALL user input before interpolating into HTML template
    const safeEventLabel = escapeHtml(EVENT_TYPE_LABELS[eventType] || eventType);
    const safeDate = escapeHtml(eventDate);
    const safeName = escapeHtml(contactName);
    const safePhone = escapeHtml(contactPhone);
    const safeEmail = contactEmail ? escapeHtml(contactEmail) : '';
    const safeEventName = escapeHtml(eventName);
    const safeStartsAt = escapeHtml(startsAt);
    const safeEndsAt = escapeHtml(endsAt);
    const safeTemplate = escapeHtml(selectedTemplate);
    const safeSpecialReqs = escapeHtml(specialReqs);

    // Build wizard-specific sections
    const wizardSections = isWizard ? `
          <div style="background: #f0f7ff; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">⚙️ פרטים מורחבים (Wizard)</h2>
            ${safeEventName ? `<p style="margin: 4px 0; color: #555;"><strong>שם האירוע:</strong> ${safeEventName}</p>` : ''}
            ${safeStartsAt ? `<p style="margin: 4px 0; color: #555;"><strong>התחלה:</strong> ${safeStartsAt}</p>` : ''}
            ${safeEndsAt ? `<p style="margin: 4px 0; color: #555;"><strong>סיום:</strong> ${safeEndsAt}</p>` : ''}
            <p style="margin: 4px 0; color: #555;"><strong>רקע מותאם:</strong> ${wantsCustomBg ? '✅ כן' : '❌ לא'}${hasBgImage ? ' (תמונה מצורפת)' : ''}</p>
            <p style="margin: 4px 0; color: #555;"><strong>פוסטר:</strong> ${posterChoice === 'qr-only' ? 'QR בלבד' : `תבנית: ${safeTemplate}`}</p>
            ${safeSpecialReqs ? `<p style="margin: 4px 0; color: #555;"><strong>בקשות מיוחדות:</strong> ${safeSpecialReqs}</p>` : ''}
            <p style="margin: 4px 0; color: #555;"><strong>הודעות לאורחים:</strong> ${wantsMessages ? '✅ כן' : '❌ לא'}</p>
            <p style="margin: 4px 0; color: #555;"><strong>העדפת קשר:</strong> ${contactPref === 'call-me' ? '📞 צרו איתי קשר' : '🔗 שלחו לינק לתשלום'}</p>
          </div>` : '';

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
      subject: `🎉 הזמנה חדשה${isWizard ? ' (Wizard)' : ''} - ${safeEventLabel} | ${safeName}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #d4a59a; font-size: 24px; margin-bottom: 24px;">📋 הזמנה חדשה מהאתר${isWizard ? ' (Wizard)' : ''}</h1>
          
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">פרטי האירוע</h2>
            <p style="margin: 4px 0; color: #555;"><strong>סוג:</strong> ${safeEventLabel}</p>
            <p style="margin: 4px 0; color: #555;"><strong>תאריך:</strong> ${safeDate}</p>
          </div>

          ${wizardSections}

          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">פרטי יצירת קשר</h2>
            <p style="margin: 4px 0; color: #555;"><strong>שם:</strong> ${safeName}</p>
            <p style="margin: 4px 0; color: #555;"><strong>טלפון:</strong> <a href="tel:${safePhone}">${safePhone}</a></p>
            ${safeEmail ? `<p style="margin: 4px 0; color: #555;"><strong>אימייל:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>` : ''}
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #999;">נשלח מ${isWizard ? 'ויזארד ההזמנות' : 'טופס ההזמנה'} באתר eventa.productions</p>
        </div>
      `,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    logger.info('Order email sent', { eventType, contactName: safeName, source: isWizard ? 'wizard' : 'form' });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Order email error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to send order' }, { status: 500 });
  }
}
