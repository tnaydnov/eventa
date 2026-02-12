import { NextRequest, NextResponse } from 'next/server';
import { signSessionToken, sessionCookieHeader } from '@/lib/session';
import { jsonError } from '@/lib/route-helpers';

/**
 * POST /api/auth/test-login
 * DEV-ONLY: Sets session cookie for a participant without the join flow.
 * Blocked in production — returns 404 to avoid exposing the endpoint.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return jsonError('Not found', 404);
  }

  try {
    const { participantId, eventId, eventSlug, eventName } = await req.json();
    if (!participantId || !eventId || !eventSlug || !eventName) {
      return jsonError('Missing fields', 400);
    }

    const token = signSessionToken({ participantId, eventId, eventSlug, eventName });
    const response = NextResponse.json({ ok: true });
    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (err) {
    console.error('[AUTH_TEST_LOGIN] error:', err);
    return jsonError('Bad request', 400);
  }
}
