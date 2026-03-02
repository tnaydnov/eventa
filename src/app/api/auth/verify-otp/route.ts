import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { signSessionToken, sessionCookieHeader, checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyOtpSchema } from '@/lib/validations';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { normalizePhone, isValidIsraeliMobile } from '@/lib/messaging';
import { verifyOtp } from '@/lib/otp';
import { sendWelcomeMessage } from '@/lib/messaging';
import type { EventMessagingConfig } from '@/lib/messaging';

/** Fingerprint hex/UUID pattern, max 64 chars for regular, 128 for hardware */
const FP_PATTERN = /^[a-f0-9-]+$/i;

/**
 * POST /api/auth/verify-otp
 * Verify OTP, create/reconnect participant, issue session, send welcome WA.
 *
 * Flow:
 *  1. CSRF check
 *  2. Rate limit (auth tier: 5/min)
 *  3. Normalize phone
 *  4. Lookup event by slug + joinCode
 *  5. Verify OTP code
 *  6. Check ban status (phone + fingerprints)
 *  7. Find existing participant by phone + event_id → reconnect or create
 *  8. Sign session JWT, set httpOnly cookie
 *  9. Fire-and-forget: send welcome WhatsApp if eligible
 * 10. Return session data
 */
export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return jsonError('Forbidden', 403);
  }

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`verify-otp:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    res.headers.set('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
    return res;
  }

  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid input', 400);
    }

    const { code, eventSlug, joinCode, smsConsent, feedbackConsent } = parsed.data;

    // Normalize phone to E.164
    const phone = normalizePhone(parsed.data.phone);
    if (!phone || !isValidIsraeliMobile(phone)) {
      return jsonError('Invalid phone number', 400);
    }

    // Sanitize fingerprints
    const fingerprint: string | null =
      typeof parsed.data.fingerprint === 'string' && parsed.data.fingerprint.length > 0
        ? (FP_PATTERN.test(parsed.data.fingerprint.slice(0, 64))
            ? parsed.data.fingerprint.slice(0, 64)
            : null)
        : null;

    const hwFingerprint: string | null =
      typeof parsed.data.hardwareFingerprint === 'string' &&
      parsed.data.hardwareFingerprint.length > 0
        ? (FP_PATTERN.test(parsed.data.hardwareFingerprint.slice(0, 128))
            ? parsed.data.hardwareFingerprint.slice(0, 128)
            : null)
        : null;

    const supabase = getServiceClient();

    // Find active event by slug + join code
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, slug, name, join_code, is_active, background_image, wa_messages_enabled')
      .eq('slug', eventSlug)
      .eq('join_code', joinCode)
      .eq('is_active', true)
      .maybeSingle();

    if (eventError) {
      logger.error('[VERIFY_OTP] event lookup failed', { error: eventError.message });
      return jsonError('Server error', 500);
    }

    if (!event) {
      return jsonError('Invalid event or join code', 404);
    }

    // Verify OTP code
    const otpResult = await verifyOtp(phone, event.id, code);
    if (!otpResult.valid) {
      const status = otpResult.error.includes('Too many') ? 429 : 400;
      return jsonError(otpResult.error, status);
    }

    // Check if phone or fingerprints are banned
    const banChecks: PromiseLike<boolean>[] = [];

    // Check phone ban
    banChecks.push(
      supabase
        .from('banned_devices')
        .select('id')
        .eq('event_id', event.id)
        .eq('device_fingerprint', phone)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            logger.error('[VERIFY_OTP] phone ban check error', { error: error.message });
            return true; // fail closed
          }
          return !!data;
        })
    );

    if (fingerprint) {
      banChecks.push(
        supabase
          .from('banned_devices')
          .select('id')
          .eq('event_id', event.id)
          .eq('device_fingerprint', fingerprint)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              logger.error('[VERIFY_OTP] fingerprint ban check error', { error: error.message });
              return true; // fail closed
            }
            return !!data;
          })
      );
    }

    if (hwFingerprint) {
      banChecks.push(
        supabase
          .from('banned_devices')
          .select('id')
          .eq('event_id', event.id)
          .eq('device_fingerprint', hwFingerprint)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              logger.error('[VERIFY_OTP] hw ban check error', { error: error.message });
              return true; // fail closed
            }
            return !!data;
          })
      );
    }

    const banResults = await Promise.all(banChecks);
    if (banResults.some((banned) => banned)) {
      return jsonError('Phone is banned from this event', 403);
    }

    // Find existing participant by phone + event
    let participantId: string | null = null;
    let participant: Record<string, unknown> | null = null;

    const { data: existing } = await supabase
      .from('participants')
      .select(
        'id, event_id, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at, phone, sms_consent, feedback_consent, feedback_sent'
      )
      .eq('event_id', event.id)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      // Reconnect
      if (existing.is_banned) {
        return jsonError('Phone is banned from this event', 403);
      }

      participantId = existing.id as string;
      participant = existing;

      // Update fingerprints + sms_consent + last_seen_at
      const updates: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };
      if (fingerprint) updates.device_fingerprint = fingerprint;
      if (hwFingerprint) updates.hardware_fingerprint = hwFingerprint;
      if (smsConsent !== existing.sms_consent) updates.sms_consent = smsConsent;
      if (feedbackConsent !== undefined && feedbackConsent !== existing.feedback_consent) updates.feedback_consent = feedbackConsent;

      Promise.resolve(
        supabase.from('participants').update(updates).eq('id', participantId)
      ).catch((err) =>
        logger.error('[VERIFY_OTP] participant update error', { error: err })
      );
    } else {
      // Create new participant
      const { data: newP, error: createError } = await supabase
        .from('participants')
        .insert({
          event_id: event.id,
          phone,
          device_fingerprint: fingerprint,
          hardware_fingerprint: hwFingerprint,
          display_name: '',
          gender: 'male',
          attracted_to: 'all',
          bio: null,
          is_banned: false,
          sms_consent: smsConsent,
          feedback_consent: feedbackConsent ?? false,
        })
        .select('id')
        .single();

      if (createError || !newP) {
        logger.error('[VERIFY_OTP] Failed to create participant', {
          error: createError?.message,
        });
        return jsonError('Failed to create participant', 500);
      }

      participantId = newP.id;

      // Activity log for new join (fire-and-forget)
      Promise.resolve(
        supabase.from('activity_log').insert({
          event_id: event.id,
          participant_id: newP.id,
          action: 'join',
        })
      ).catch((err) =>
        logger.error('[VERIFY_OTP] activity log error', { error: err })
      );
    }

    // Guard: should never happen
    if (!participantId) {
      return jsonError('Failed to resolve participant', 500);
    }

    // Sign session JWT
    const token = signSessionToken({
      participantId,
      eventId: event.id,
      eventSlug,
      eventName: event.name,
    });

    // Fire-and-forget: send welcome WA if eligible and WA is enabled
    if (event.wa_messages_enabled && smsConsent) {
      const msgConfig: EventMessagingConfig = {
        eventId: event.id,
        eventName: event.name,
        eventSlug: event.slug,
        joinCode: event.join_code,
        waMessagesEnabled: event.wa_messages_enabled,
      };

      Promise.resolve(sendWelcomeMessage(phone, msgConfig)).catch((err) =>
        logger.error('[VERIFY_OTP] welcome message error', { error: err })
      );
    }

    // Build response — strip sensitive fields
    const safeParticipant = participant
      ? (({
          device_fingerprint,
          hardware_fingerprint,
          phone: _phone,
          ...safe
        }: Record<string, unknown>) => safe)(participant)
      : null;

    const response = NextResponse.json({
      eventId: event.id,
      eventName: event.name,
      backgroundImage: event.background_image ?? null,
      participantId,
      participant: safeParticipant,
    });

    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (err) {
    logger.error('[VERIFY_OTP] error', { error: err });
    return jsonError('Server error', 500);
  }
}
