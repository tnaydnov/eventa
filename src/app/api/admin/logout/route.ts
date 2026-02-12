import { NextResponse } from 'next/server';
import { clearAdminCookieHeader } from '@/lib/admin-auth';

/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', clearAdminCookieHeader());
  return res;
}
