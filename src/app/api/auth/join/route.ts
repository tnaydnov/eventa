import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { signSessionToken, sessionCookieHeader, checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { joinEventSchema } from '@/lib/validations';
import { jsonError } from '@/lib/route-helpers';

/**
 * POST /api/auth/join
 * Verifies join code, creates or reconnects participant, sets session cookie.
 *
 * Flow:
 *  1. CSRF check
 *  2. Rate limit
 *  3. Validate input (Zod)
 *  4. Lookup event by slug + join_code
 *  5. Check device ban
 *  6. Check if banned participant exists for fingerprint
 *  7. Find/create participant
 *  8. Issue session JWT
 */
export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return jsonError('Forbidden', 403);
  }

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`join:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  try {
    const body = await req.json();

    // Validate required fields with Zod
    const parsed = joinEventSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid input', 400);
    }

    const { eventSlug, joinCode } = parsed.data;
    // Fingerprint is optional — sanitize to plain string or null
    const fingerprint: string | null =
      typeof body.fingerprint === 'string' && body.fingerprint.length > 0
        ? body.fingerprint.slice(0, 64)
        : null;

    const supabase = getServiceClient();

    // Find active event by slug + join code
    const { data: event } = await supabase
      .from('events')
      .select('id, slug, name, join_code, event_type, status, starts_at, ends_at, is_active, background_image')
      .eq('slug', eventSlug)
      .eq('join_code', joinCode)
      .eq('is_active', true)
      .single();

    if (!event) {
      return jsonError('Invalid event or join code', 404);
    }

    // Check if this device fingerprint is banned for this event
    if (fingerprint) {
      const { data: banned } = await supabase
        .from('banned_devices')
        .select('id')
        .eq('event_id', event.id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();

      if (banned) {
        return jsonError('Device is banned from this event', 403);
      }
    }

    let participantId: string | null = null;
    let participant: Record<string, unknown> | null = null;

    // Reconnect existing participant by fingerprint
    if (fingerprint) {
      const { data: existing } = await supabase
        .from('participants')
        .select('id, event_id, device_fingerprint, display_name, gender, attracted_to, bio, age, city, looking_for, is_banned, last_seen_at, created_at')
        .eq('event_id', event.id)
        .eq('device_fingerprint', fingerprint)
        .single();

      if (existing) {
        // Reject banned participants even if device ban table was missed
        if (existing.is_banned) {
          return jsonError('Device is banned from this event', 403);
        }
        participantId = existing.id;
        participant = existing;
      }
    }

    // Create new participant stub if none found
    if (!participantId) {
      const { data: newP, error } = await supabase
        .from('participants')
        .insert({
          event_id: event.id,
          device_fingerprint: fingerprint,
          display_name: '',
          gender: 'male',
          attracted_to: 'all',
          bio: null,
          is_banned: false,
        })
        .select('id')
        .single();

      if (error || !newP) {
        console.error('[AUTH_JOIN] Failed to create participant:', error?.message);
        return jsonError('Failed to create participant', 500);
      }
      participantId = newP.id;

      // Activity log for new join (fire-and-forget)
      supabase.from('activity_log').insert({
        event_id: event.id,
        participant_id: newP.id,
        action: 'join',
      }).then();
    }

    // Guard: should never happen — either existing or newly created
    if (!participantId) {
      return jsonError('Failed to resolve participant', 500);
    }

    // Sign session JWT and set as httpOnly cookie
    const token = signSessionToken({
      participantId,
      eventId: event.id,
      eventSlug,
      eventName: event.name,
    });

    const response = NextResponse.json({
      eventId: event.id,
      eventName: event.name,
      backgroundImage: event.background_image ?? null,
      participantId,
      participant,
    });

    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (err) {
    console.error('[AUTH_JOIN] error:', err);
    return jsonError('Server error', 500);
  }
}
