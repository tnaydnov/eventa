import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookieHeader, checkCsrf } from '@/lib/session';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/verify
 * Verifies the session cookie and returns session data.
 * Also checks if the participant is banned - if so, clears the cookie
 * so the session is not restored on the client.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`verify:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return jsonError('Not authenticated', 401);
  }

  // Check if participant is banned - reject and clear cookie if so
  // Fail-closed: if DB errors, treat as banned to prevent bypass
  const supabase = getServiceClient();
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('is_banned')
    .eq('id', session.sub)
    .maybeSingle();

  if (participantError) {
    logger.error('[AUTH_VERIFY] participant lookup failed', { error: participantError.message });
    return jsonError('Server error', 500);
  }

  if (!participant) {
    // Participant deleted (e.g. self-deletion) - clear stale session
    const response = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  }

  if (participant?.is_banned) {
    const response = NextResponse.json({ error: 'Account banned' }, { status: 403 });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  }

  // Check event status - kick users from paused/archived/deleted events
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('status, is_active')
    .eq('id', session.eid)
    .maybeSingle();

  if (eventError) {
    logger.error('[AUTH_VERIFY] event lookup failed', { error: eventError.message });
    return jsonError('Server error', 500);
  }

  if (!event) {
    // Event was deleted from DB
    const response = NextResponse.json(
      { error: 'event_inactive', reason: 'deleted', eventSlug: session.esl },
      { status: 410 }
    );
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  }

  if (event.status === 'paused') {
    const response = NextResponse.json(
      { error: 'event_inactive', reason: 'paused', eventSlug: session.esl },
      { status: 410 }
    );
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  }

  if (event.status === 'archived') {
    const response = NextResponse.json(
      { error: 'event_inactive', reason: 'archived', eventSlug: session.esl },
      { status: 410 }
    );
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  }

  return NextResponse.json({
    participantId: session.sub,
    eventId: session.eid,
    eventSlug: session.esl,
    eventName: session.enm,
  });
}

/**
 * DELETE /api/auth/verify
 * Clears the session cookie (logout).
 */
export async function DELETE(req: NextRequest) {
  if (!checkCsrf(req)) {
    return jsonError('Forbidden', 403);
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`logout:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookieHeader());
  return response;
}
