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

/** Zod schema for order form — validates and sanitizes all inputs. */
const orderSchema = z.object({
  eventType: z.string().min(1).max(50),
  eventDate: z.string().min(1).max(20),
  contactName: z.string().min(1).max(ORDER_NAME_MAX_LENGTH),
  contactPhone: z.string().min(1).max(ORDER_PHONE_MAX_LENGTH)
    .regex(/^[\d\s+\-()]+$/, 'Invalid phone format'),
  contactEmail: z.string().max(ORDER_EMAIL_MAX_LENGTH).email().optional()
    .or(z.literal('')),
});

/**
 * POST /api/order
 * Receives a new order form submission and sends an email notification.
 * Protected by CSRF + rate limiting (no session required — public form).
 */
export async function POST(request: NextRequest) {
  // CSRF check (defense-in-depth for public forms)
  if (!checkCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit by IP — use strict config (3/min) to prevent spam
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

    // Escape ALL user input before interpolating into HTML template
    const safeEventLabel = escapeHtml(EVENT_TYPE_LABELS[eventType] || eventType);
    const safeDate = escapeHtml(eventDate);
    const safeName = escapeHtml(contactName);
    const safePhone = escapeHtml(contactPhone);
    const safeEmail = contactEmail ? escapeHtml(contactEmail) : '';

    await transporter.sendMail({
      from: `"Eventa" <${process.env.SMTP_USER}>`,
      to: 'contact@eventa.productions',
      subject: `🎉 הזמנה חדשה — ${safeEventLabel} | ${safeName}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #d4a59a; font-size: 24px; margin-bottom: 24px;">📋 הזמנה חדשה מהאתר</h1>
          
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">פרטי האירוע</h2>
            <p style="margin: 4px 0; color: #555;"><strong>סוג:</strong> ${safeEventLabel}</p>
            <p style="margin: 4px 0; color: #555;"><strong>תאריך:</strong> ${safeDate}</p>
          </div>

          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px;">
            <h2 style="font-size: 18px; color: #333; margin: 0 0 12px;">פרטי יצירת קשר</h2>
            <p style="margin: 4px 0; color: #555;"><strong>שם:</strong> ${safeName}</p>
            <p style="margin: 4px 0; color: #555;"><strong>טלפון:</strong> <a href="tel:${safePhone}">${safePhone}</a></p>
            ${safeEmail ? `<p style="margin: 4px 0; color: #555;"><strong>אימייל:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>` : ''}
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #999;">נשלח מטופס ההזמנה באתר eventa.productions</p>
        </div>
      `,
    });

    logger.info('Order email sent', { eventType, contactName: safeName });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Order email error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to send order' }, { status: 500 });
  }
}
