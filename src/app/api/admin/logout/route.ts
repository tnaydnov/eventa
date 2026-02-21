import { NextRequest, NextResponse } from 'next/server';
import { clearAdminCookieHeader } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 * Rate-limited to prevent abuse; no auth check needed (clearing a cookie is safe).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`admin-logout:${ip}`, RATE_LIMITS.standard);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', clearAdminCookieHeader());
  return res;
}
