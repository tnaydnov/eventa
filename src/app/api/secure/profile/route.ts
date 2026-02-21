import { NextRequest, NextResponse } from 'next/server';
import { serviceUpdate } from '@/lib/supabase';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { profileSetupSchema } from '@/lib/validations';
import { MAX_NAME_LENGTH, MAX_BIO_LENGTH, MAX_CITY_LENGTH } from '@/lib/constants';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

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

    // Validate with Zod (partial — all fields optional on update)
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
    }
    if (parsed.data.bio !== undefined) {
      allowed.bio = parsed.data.bio ? sanitizeWithLimit(parsed.data.bio, MAX_BIO_LENGTH) : null;
    }
    if (parsed.data.age !== undefined) {
      allowed.age = parsed.data.age; // Already validated by Zod (18-120, required)
    }
    if (parsed.data.city !== undefined) {
      allowed.city = parsed.data.city ? sanitizeWithLimit(parsed.data.city, MAX_CITY_LENGTH) : null;
    }
    if (parsed.data.looking_for !== undefined) {
      allowed.looking_for = parsed.data.looking_for; // Already validated by Zod enum
    }

    if (Object.keys(allowed).length === 0) {
      return jsonError('No valid fields to update', 400);
    }

    logger.info('[PROFILE] update attempt', { sub: session.sub, eid: session.eid, fields: Object.keys(allowed).join(',') });

    const { data: rows, error } = await serviceUpdate(
      'participants',
      allowed,
      { id: session.sub, event_id: session.eid }
    );

    if (error) {
      logger.error('[PROFILE] update error:', { message: error.message, code: error.code, details: error.details });
      return jsonError(`Failed to update profile: ${error.message}`, 400);
    }
    if (!rows || (rows as unknown[]).length === 0) {
      logger.error('[PROFILE] update matched 0 rows — sub=' + session.sub + ' eid=' + session.eid);
      return jsonError('Participant not found', 404);
    }
    return NextResponse.json((rows as unknown[])[0]);
  } catch (err) {
    logger.error('[PROFILE] error:', err);
    return jsonError('Server error', 500);
  }
}
