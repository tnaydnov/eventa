import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookieHeader, checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { jsonError } from '@/lib/route-helpers';

/**
 * GET /api/auth/verify
 * Verifies the session cookie and returns session data.
 * Also checks if the participant is banned — if so, clears the cookie
 * so the session is not restored on the client.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`verify:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return jsonError('Not authenticated', 401);
  }

  // Check if participant is banned — reject and clear cookie if so
  const supabase = getServiceClient();
  const { data: participant } = await supabase
    .from('participants')
    .select('is_banned')
    .eq('id', session.sub)
    .single();

  if (participant?.is_banned) {
    const response = NextResponse.json({ error: 'Account banned' }, { status: 403 });
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

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookieHeader());
  return response;
}
