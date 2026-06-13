import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkCsrf } from '@/lib/session';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { OTP_MAX_PER_PHONE_PER_HOUR, OTP_GLOBAL_MAX_PER_DAY } from '@/lib/config';
import { sendOtpSchema } from '@/lib/validations';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { normalizePhone, isValidIsraeliMobile, maskPhone } from '@/lib/messaging';
import { createOtp } from '@/lib/otp';
import { sendOtp as sendOtpSms } from '@/lib/messaging';

/**
 * POST /api/auth/send-otp
 * Validate event + phone, generate OTP, send SMS.
 *
 * Flow:
 *  1. CSRF check
 *  2. Rate limit (auth tier: 5/min)
 *  3. Validate + normalize phone number
 *  4. Lookup event by slug + is_active
 *  5. Check if phone is banned for this event
 *  6. Create OTP (with cooldown check)
 *  7. Send SMS
 *  8. Return masked phone + expiry
 */
export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return jsonError('Forbidden', 403);
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`send-otp:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    res.headers.set('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
    return res;
  }

  try {
    const body = await req.json();
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid input', 400);
    }

    const { eventSlug, joinCode } = parsed.data;

    // Normalize phone to E.164
    const phone = normalizePhone(parsed.data.phone);
    if (!phone || !isValidIsraeliMobile(phone)) {
      return jsonError('Invalid phone number', 400);
    }

    // ── Toll-fraud guards (SMS pumping) ──────────────────────────────
    // These hold cross-instance when Upstash is configured; otherwise per-instance.
    // 1) Per-phone hourly cap — a legitimate user never needs this many codes.
    const phoneRl = await checkRateLimitAsync(`send-otp-phone:${phone}`, {
      maxRequests: OTP_MAX_PER_PHONE_PER_HOUR,
      windowMs: 60 * 60_000,
    });
    if (!phoneRl.allowed) {
      logger.warn('[SEND_OTP] per-phone cap hit', { phone: maskPhone(phone) });
      const res = NextResponse.json({ error: 'Too many requests for this number' }, { status: 429 });
      res.headers.set('Retry-After', String(Math.ceil(phoneRl.resetMs / 1000)));
      return res;
    }
    // 2) Optional global daily backstop across ALL phones (bounds attack blast radius).
    if (OTP_GLOBAL_MAX_PER_DAY > 0) {
      const globalRl = await checkRateLimitAsync('send-otp-global', {
        maxRequests: OTP_GLOBAL_MAX_PER_DAY,
        windowMs: 24 * 60 * 60_000,
      });
      if (!globalRl.allowed) {
        logger.error('[SEND_OTP] GLOBAL daily OTP cap hit — possible SMS pumping attack');
        return jsonError('Service temporarily unavailable', 503);
      }
    }

    const supabase = getServiceClient();

    // Find active event by slug (join code no longer required in URL)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, slug, name, is_active')
      .eq('slug', eventSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (eventError) {
      logger.error('[SEND_OTP] event lookup failed', { error: eventError.message });
      return jsonError('Server error', 500);
    }

    if (!event) {
      return jsonError('Event not found', 404);
    }

    // Check if this phone is banned for this event
    const { data: banned, error: banError } = await supabase
      .from('banned_devices')
      .select('id')
      .eq('event_id', event.id)
      .eq('device_fingerprint', phone)
      .maybeSingle();

    if (banError) {
      logger.error('[SEND_OTP] ban check error', { error: banError.message });
      return jsonError('Server error', 500); // fail closed
    }

    if (banned) {
      return jsonError('Phone is blocked from this event', 403);
    }

    // Create OTP (checks cooldown internally)
    const otpResult = await createOtp(phone, event.id);
    if ('error' in otpResult) {
      return jsonError(otpResult.error, 429);
    }

    // Send SMS
    const smsResult = await sendOtpSms(phone, otpResult.code, event.id);
    if (!smsResult.success) {
      logger.error('[SEND_OTP] SMS send failed', {
        phone: maskPhone(phone),
        eventId: event.id,
        error: smsResult.error,
      });
      return jsonError('Failed to send verification code', 500);
    }

    // Fire-and-forget: record funnel step otp_requested
    void supabase.from('funnel_events').insert({
      event_id: event.id,
      step: 'otp_requested',
      metadata: {},
    }).then(({ error }) => {
      if (error) logger.error('[SEND_OTP] funnel insert error', { error: error.message });
    });

    return NextResponse.json({
      success: true,
      expiresIn: otpResult.expiresIn,
      maskedPhone: maskPhone(phone),
    });
  } catch (err) {
    logger.error('[SEND_OTP] error', { error: err });
    return jsonError('Server error', 500);
  }
}
