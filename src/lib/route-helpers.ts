/**
 * Shared helpers for API route handlers.
 * Eliminates repeated guard boilerplate across secure routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, checkCsrf, type SessionPayload } from '@/lib/session';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  BAN_CACHE_TTL_MS,
  BAN_CACHE_TTL_BANNED_MS,
  EVENT_STATUS_CACHE_TTL_ACTIVE_MS,
  EVENT_STATUS_CACHE_TTL_INACTIVE_MS,
  MAX_CACHE_SIZE,
} from '@/lib/config';

/** Default JSON body size limit - 256 KB. */
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
/** Larger body size limit for upload-URL route - 1 KB (it only sends a path string). */
const UPLOAD_MAX_BODY_BYTES = 1024;

/** Shorthand for JSON error response. */
export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Generate a short request ID for log correlation.
 * Uses crypto.randomUUID when available, falls back to timestamp+random.
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Bounded cache helper ────────────────────────────────────
 * Evicts oldest entries when the cache exceeds MAX_CACHE_SIZE.
 */
function boundedSet<V>(map: Map<string, V>, key: string, value: V): void {
  map.set(key, value);
  if (map.size > MAX_CACHE_SIZE) {
    // Delete first (oldest) entry
    const first = map.keys().next();
    if (!first.done) map.delete(first.value);
  }
}

/* ── Ban-check cache ─────────────────────────────────────────
 * Checking `is_banned` on every API call adds 50-200 ms. Since bans
 * change rarely, cache the "not-banned" result for 5 minutes.
 * When a participant IS banned the cache is very short-lived (10 s)
 * so the ban takes effect quickly even if a stale entry was cached.
 */
const _banCache = new Map<string, { banned: boolean; ts: number }>();

async function isBanned(participantId: string): Promise<boolean> {
  const cached = _banCache.get(participantId);
  if (cached) {
    const ttl = cached.banned ? BAN_CACHE_TTL_BANNED_MS : BAN_CACHE_TTL_MS;
    if (Date.now() - cached.ts < ttl) return cached.banned;
  }
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('participants')
    .select('is_banned')
    .eq('id', participantId)
    .maybeSingle();

  if (error) {
    logger.error('Ban check DB error - failing closed (treating as banned)', {
      participantId, error: error.message,
    });
    return true; // fail closed: deny access when DB is unreachable
  }

  // Participant deleted (self-deletion) - not banned, session is stale
  if (!data) return false;

  const banned = !!data.is_banned;
  boundedSet(_banCache, participantId, { banned, ts: Date.now() });
  return banned;
}

/** Immediately mark a participant as banned in the cache (called from admin routes). */
export function evictBanCache(participantId: string): void {
  _banCache.set(participantId, { banned: true, ts: Date.now() });
}

/* ── Event-status cache ──────────────────────────────────────
 * Cache the event status so we don't query it on every API call.
 * Active events: 5-min TTL.  Inactive events: 30-s TTL (changes propagate quickly).
 */
const _eventStatusCache = new Map<string, { status: string; ts: number }>();

async function getEventStatus(eventId: string): Promise<string | null> {
  const cached = _eventStatusCache.get(eventId);
  if (cached) {
    const isActive = cached.status === 'active' || cached.status === 'ended';
    const ttl = isActive ? EVENT_STATUS_CACHE_TTL_ACTIVE_MS : EVENT_STATUS_CACHE_TTL_INACTIVE_MS;
    if (Date.now() - cached.ts < ttl) return cached.status;
  }
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('events')
    .select('status')
    .eq('id', eventId)
    .single();

  if (error) {
    logger.error('Event status DB error - failing closed (treating as deleted)', {
      eventId, error: error.message,
    });
    _eventStatusCache.delete(eventId);
    return null; // fail closed: treat as deleted
  }

  if (!data) {
    _eventStatusCache.delete(eventId);
    return null; // event deleted
  }
  boundedSet(_eventStatusCache, eventId, { status: data.status, ts: Date.now() });
  return data.status;
}

/** Force-evict event status from cache (called from admin routes when status changes). */
export function evictEventStatusCache(eventId: string): void {
  _eventStatusCache.delete(eventId);
}

/**
 * Secure-route guard: CSRF → session → rate-limit → ban check (cached).
 * Returns the session payload on success, or a NextResponse error.
 */
export async function secureGuard(
  req: NextRequest,
  rateLimitKey: string,
  limit: RateLimitConfig,
  options?: { maxBodyBytes?: number }
): Promise<NextResponse | SessionPayload> {
  const requestId = generateRequestId();

  // Body size guard - reject oversized payloads early (DoS protection).
  // Uses Content-Length header as a fast pre-check; doesn't consume the body.
  const maxBody = options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBody) {
    logger.warn('Request body too large', { requestId, route: rateLimitKey, contentLength });
    return jsonError('Payload too large', 413);
  }

  if (!checkCsrf(req)) {
    logger.warn('CSRF check failed', { requestId, route: rateLimitKey });
    return jsonError('Forbidden', 403);
  }

  const session = getSessionFromRequest(req);
  if (!session) return jsonError('Unauthorized', 401);

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`${rateLimitKey}:${ip}`, limit);
  if (!rl.allowed) {
    logger.warn('Rate limited', { requestId, route: rateLimitKey, ip, participantId: session.sub });
    const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    res.headers.set('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
    return res;
  }

  if (await isBanned(session.sub)) {
    logger.info('Banned user blocked', { requestId, participantId: session.sub, route: rateLimitKey });
    return jsonError('Account banned', 403);
  }

  // Check event status - block API usage for paused/archived/deleted events
  const eventStatus = await getEventStatus(session.eid);
  if (!eventStatus) {
    return NextResponse.json(
      { error: 'event_inactive', reason: 'deleted' },
      { status: 410 }
    );
  }
  if (eventStatus === 'paused') {
    return NextResponse.json(
      { error: 'event_inactive', reason: 'paused' },
      { status: 410 }
    );
  }
  if (eventStatus === 'archived') {
    return NextResponse.json(
      { error: 'event_inactive', reason: 'archived' },
      { status: 410 }
    );
  }

  return session;
}

/** Reject path traversal and dangerous characters in storage paths. */
export function isSafePath(p: string): boolean {
  // Decode URL-encoded characters before checking traversal patterns
  let decoded: string;
  try {
    decoded = decodeURIComponent(p);
  } catch {
    return false; // Malformed encoding
  }
  // Reject traversal, absolute paths, and dangerous characters
  if (decoded.includes('..') || decoded.includes('//') || decoded.includes('\\') || decoded.includes('\0')) return false;
  // Reject absolute paths (Unix or Windows drive letters)
  if (decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) return false;
  return true;
}
