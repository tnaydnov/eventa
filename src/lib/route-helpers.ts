/**
 * Shared helpers for API route handlers.
 * Eliminates repeated guard boilerplate across secure routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, checkCsrf, type SessionPayload } from '@/lib/session';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';

/** Shorthand for JSON error response. */
export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/* ── Ban-check cache ─────────────────────────────────────────
 * Checking `is_banned` on every API call adds 50-200 ms. Since bans
 * change rarely, cache the "not-banned" result for 5 minutes.
 * When a participant IS banned the cache is very short-lived (10 s)
 * so the ban takes effect quickly even if a stale entry was cached.
 */
const _banCache = new Map<string, { banned: boolean; ts: number }>();
const BAN_CACHE_TTL = 5 * 60 * 1000; // 5 min for non-banned
const BAN_CACHE_TTL_BANNED = 10_000;  // 10 s for banned (quick re-check)

async function isBanned(participantId: string): Promise<boolean> {
  const cached = _banCache.get(participantId);
  if (cached) {
    const ttl = cached.banned ? BAN_CACHE_TTL_BANNED : BAN_CACHE_TTL;
    if (Date.now() - cached.ts < ttl) return cached.banned;
  }
  const sb = getServiceClient();
  const { data } = await sb
    .from('participants')
    .select('is_banned')
    .eq('id', participantId)
    .single();
  const banned = !!data?.is_banned;
  _banCache.set(participantId, { banned, ts: Date.now() });
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
const EVENT_CACHE_TTL_ACTIVE = 5 * 60 * 1000;   // 5 min for active/ended
const EVENT_CACHE_TTL_INACTIVE = 30_000;          // 30 s for paused/archived/draft

async function getEventStatus(eventId: string): Promise<string | null> {
  const cached = _eventStatusCache.get(eventId);
  if (cached) {
    const isActive = cached.status === 'active' || cached.status === 'ended';
    const ttl = isActive ? EVENT_CACHE_TTL_ACTIVE : EVENT_CACHE_TTL_INACTIVE;
    if (Date.now() - cached.ts < ttl) return cached.status;
  }
  const sb = getServiceClient();
  const { data } = await sb
    .from('events')
    .select('status')
    .eq('id', eventId)
    .single();
  if (!data) {
    _eventStatusCache.delete(eventId);
    return null; // event deleted
  }
  _eventStatusCache.set(eventId, { status: data.status, ts: Date.now() });
  return data.status;
}

/** Force-evict event status from cache (called from admin routes when status changes). */
export function evictEventStatusCache(eventId: string): void {
  _eventStatusCache.delete(eventId);
}

/**
 * Secure-route guard: CSRF → session → rate-limit → ban check (cached).
 */
export async function secureGuard(
  req: NextRequest,
  rateLimitKey: string,
  limit: RateLimitConfig
): Promise<NextResponse | SessionPayload> {
  if (!checkCsrf(req)) return jsonError('Forbidden', 403);

  const session = getSessionFromRequest(req);
  if (!session) return jsonError('Unauthorized', 401);

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`${rateLimitKey}:${ip}`, limit);
  if (!rl.allowed) return jsonError('Too many requests', 429);

  if (await isBanned(session.sub)) return jsonError('Account banned', 403);

  // Check event status — block API usage for paused/archived/deleted events
  const eventStatus = await getEventStatus(session.eid);
  if (!eventStatus) {
    // Event was deleted from DB
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
