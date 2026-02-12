import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookieHeader, checkCsrf } from '@/lib/session';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';

/**
 * GET /api/auth/verify
 * Verifies the session cookie and returns session data.
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
