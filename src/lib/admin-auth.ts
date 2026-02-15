/**
 * Admin authentication via signed JWT stored in httpOnly cookie.
 *
 * Stateless — no in-memory token store needed.
 * Works perfectly on serverless (Vercel) with zero cold-start issues.
 */
import crypto from 'crypto';

const ADMIN_COOKIE = 'ws_admin';
const MAX_AGE = 24 * 60 * 60; // 24 hours

interface AdminPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

/** Sign an admin JWT */
export function signAdminToken(): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: AdminPayload = { role: 'admin', iat: now, exp: now + MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

/** Verify an admin JWT. Returns true if valid. */
export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const secret = getSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, body, sig] = parts;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

    const payload: AdminPayload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.role !== 'admin') return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

/** Build Set-Cookie header for admin JWT */
export function adminCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  // SameSite=Strict — admin panel never needs cross-site cookie sending
  return `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}${secure}`;
}

/** Build Set-Cookie header to clear admin cookie */
export function clearAdminCookieHeader(): string {
  return `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Extract admin token from request cookies.
 *  Prefers the NextRequest .cookies API when available, falls back to manual header parsing. */
export function getAdminTokenFromRequest(req: Request): string | null {
  // NextRequest (App Router) exposes a typed cookies helper
  const nxReq = req as Request & { cookies?: { get(name: string): { value: string } | undefined } };
  if (nxReq.cookies) {
    const val = nxReq.cookies.get(ADMIN_COOKIE)?.value;
    if (val) return val;
  }
  // Fallback: parse raw header
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]*)`));
  return match ? match[1] : null;
}

/** Verify admin from request — cookie-only, no header fallback */
export function verifyAdminFromRequest(req: Request): boolean {
  // Only accept httpOnly cookie — no Authorization header fallback.
  // This eliminates token-in-header attack surface and ensures
  // SameSite=Strict protection is always enforced.
  const cookieToken = getAdminTokenFromRequest(req);
  return cookieToken ? verifyAdminToken(cookieToken) : false;
}



/**
 * Audit log for admin actions.
 * In production, pipe to a structured logging service (Datadog, etc.).
 */
export function adminAuditLog(
  action: string,
  details: Record<string, unknown> = {},
  req?: Request
): void {
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req?.headers.get('x-real-ip')
    || 'unknown';
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'ADMIN_AUDIT',
    action,
    ip,
    ...details,
  };
  // Structured JSON log — easy to parse by log aggregators
  console.log(JSON.stringify(entry));
}
