/**
 * Server-side JWT session management.
 * Signs and verifies session tokens stored as httpOnly cookies.
 */
import crypto from 'crypto';
import { SESSION_MAX_AGE_S, JWT_ISSUER, JWT_AUDIENCE, getJwtSecret, IS_PRODUCTION } from '@/lib/config';

const COOKIE_NAME = 'ws_session';

export interface SessionPayload {
  typ: 'session'; // discriminator - prevents admin tokens from passing session verification
  iss?: string;   // issuer
  aud?: string;   // audience
  sub: string;    // participantId
  eid: string;    // eventId
  esl: string;    // eventSlug
  enm: string;    // eventName
  sep?: number;   // session epoch - revocation counter (see migration 039); optional for legacy tokens
  iat: number;
  exp: number;
}

/** Sign a session JWT using HMAC-SHA256 */
export function signSessionToken(data: {
  participantId: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  /** Current session epoch for revocation support. Omit for legacy callers (treated as no `sep`). */
  sessionEpoch?: number;
}): string {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: SessionPayload = {
    typ: 'session',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: data.participantId,
    eid: data.eventId,
    esl: data.eventSlug,
    enm: data.eventName,
    iat: now,
    exp: now + SESSION_MAX_AGE_S,
  };
  // Only embed the epoch claim when provided, so legacy/omitted callers stay byte-compatible.
  if (typeof data.sessionEpoch === 'number') payload.sep = data.sessionEpoch;
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

/** Verify a session JWT. Returns payload if valid, null otherwise. */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const secret = getJwtSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload: SessionPayload = JSON.parse(Buffer.from(body, 'base64url').toString());

    // Validate discriminator - reject admin tokens and malformed payloads
    if (payload.typ !== 'session') return null;
    if (!payload.sub || !payload.eid || !payload.esl) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Soft-verify iss/aud - reject if present but wrong (accepts old tokens without them)
    if (payload.iss && payload.iss !== JWT_ISSUER) return null;
    if (payload.aud && payload.aud !== JWT_AUDIENCE) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Build the Set-Cookie header for a session token */
export function sessionCookieHeader(token: string): string {
  const secure = IS_PRODUCTION ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_S}${secure}`;
}

/** Build the Set-Cookie header to clear the session */
export function clearSessionCookieHeader(): string {
  const secure = IS_PRODUCTION ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

/** Extract and verify session from a Request's cookies */
export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  return verifySessionToken(match[1]);
}

/**
 * CSRF protection: verify Origin header matches Host.
 * SameSite=Lax already blocks cross-site POST cookies, this is defense-in-depth.
 */
export function checkCsrf(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  // Origin is always sent by browsers on POST/PATCH/DELETE.
  // If missing, it's either a non-browser client or a same-origin GET.
  if (!origin) {
    // Allow GET/HEAD requests without Origin (navigations)
    const method = req.method.toUpperCase();
    return method === 'GET' || method === 'HEAD';
  }
  if (!host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

/**
 * Validates that a string is a valid UUID v4.
 * Use before interpolating user-supplied IDs into Supabase .or() filters.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}
