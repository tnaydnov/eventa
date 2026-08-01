import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { profileSetupSchema } from '@/lib/validations';
import { MAX_NAME_LENGTH, MAX_BIO_LENGTH, MAX_CITY_LENGTH } from '@/lib/constants';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { enqueueInactivitySms } from '@/lib/notification-dispatcher';
import { encryptPii } from '@/lib/pii';

/**
 * PATCH /api/secure/profile
 * Update the authenticated participant's profile.
 * Uses Zod (profileSetupSchema) for field-level validation.
 */
export async function PATCH(req: NextRequest) {
  const guard = await secureGuard(req, 'profile', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const data = await req.json();

    // Validate with Zod (partial - all fields optional on update)
    const parsed = profileSetupSchema.partial().safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid input';
      return jsonError(firstError, 400);
    }

    // Build sanitized update object from validated fields only
    const allowed: Record<string, unknown> = {};

    if (parsed.data.display_name !== undefined) {
      allowed.display_name = sanitizeWithLimit(parsed.data.display_name, MAX_NAME_LENGTH);
    }
    if (parsed.data.gender !== undefined) {
      allowed.gender = parsed.data.gender;
    }
    if (parsed.data.attracted_to !== undefined) {
      allowed.attracted_to = parsed.data.attracted_to;
      allowed.attracted_to_enc = encryptPii(parsed.data.attracted_to);
    }
    if (parsed.data.bio !== undefined) {
      const bioVal = parsed.data.bio ? sanitizeWithLimit(parsed.data.bio, MAX_BIO_LENGTH) : null;
      allowed.bio_enc = encryptPii(bioVal);
    }
    if (parsed.data.age !== undefined) {
      allowed.age = parsed.data.age; // Already validated by Zod (18-120, required)
    }
    if (parsed.data.city !== undefined) {
      allowed.city = parsed.data.city ? sanitizeWithLimit(parsed.data.city, MAX_CITY_LENGTH) : null;
    }
    if (parsed.data.looking_for !== undefined) {
      allowed.looking_for_enc = encryptPii(parsed.data.looking_for);
    }

    // sms_notifications_enabled is not part of profileSetupSchema - handle separately
    if (typeof (data as Record<string, unknown>).sms_notifications_enabled === 'boolean') {
      allowed.sms_notifications_enabled = (data as Record<string, unknown>).sms_notifications_enabled as boolean;
    }

    if (Object.keys(allowed).length === 0) {
      return jsonError('No valid fields to update', 400);
    }

    logger.info('[PROFILE] update attempt', { sub: session.sub, eid: session.eid, fields: Object.keys(allowed).join(',') });

    const supabase = getServiceClient();
    const { data: rows, error } = await supabase
      .from('participants')
      .update(allowed)
      .eq('id', session.sub)
      .eq('event_id', session.eid)
      .select();

    if (error) {
      logger.error('[PROFILE] update error:', { message: error.message, code: error.code, details: error.details });
      return jsonError('Failed to update profile', 400);
    }
    if (!rows || rows.length === 0) {
      logger.error('[PROFILE] update matched 0 rows - sub=' + session.sub + ' eid=' + session.eid);
      return jsonError('Participant not found', 404);
    }

    // Fire profile_complete event if all required fields are now set (fire-and-forget)
    const updated = rows[0] as Record<string, unknown>;
    if (updated.display_name && updated.gender && updated.attracted_to && updated.age) {
      eventBus.emit('profile_complete', {
        event_id: session.eid,
        participant_id: session.sub,
      });
      const supabase2 = getServiceClient();
      // Record funnel step
      void supabase2
        .from('funnel_events')
        .insert({ event_id: session.eid, session_id: session.sub, step: 'profile_complete', metadata: {} })
        .then(({ error }) => {
          if (error && error.code !== '23505') logger.error('[PROFILE] funnel insert error:', error.message);
        });
      // Cancel any pending abandoned-funnel SMS since user completed profile
      void supabase2
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'profile_completed' })
        .eq('recipient_id', session.sub)
        .eq('event_id', session.eid)
        .eq('message_type', 'abandoned_funnel')
        .is('sent_at', null)
        .is('cancelled_at', null)
        .then(({ error }) => {
          if (error) logger.error('[PROFILE] cancel abandoned_funnel sms error:', error.message);
        });

      // Schedule inactivity nudge (+30m) for participants who completed setup
      // but still haven't engaged (no likes/messages).
      void enqueueInactivitySms(session.sub, session.eid);
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    logger.error('[PROFILE] error:', err);
    return jsonError('Server error', 500);
  }
}
