/**
 * Shared helpers for API route handlers.
 * Eliminates repeated guard boilerplate across secure routes.
 */
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, checkCsrf, type SessionPayload } from '@/lib/session';
import { checkRateLimitAsync, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';
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
 * Verify a Vercel Cron / internal caller via the `Authorization: Bearer <CRON_SECRET>`
 * header using a timing-safe comparison.
 *
 * Centralised here so every caller (admin guard, cron jobs, payment webhook manual
 * trigger) shares one implementation. Returns `false` when `CRON_SECRET` is unset
 * (fail-closed) so a missing secret never silently authorises a request.
 */
export function verifyCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${cronSecret}`;
  // Hash both sides to a fixed 32-byte digest before comparing so the length
  // of the supplied header can never leak via the timing-safe length check.
  const authHash = crypto.createHash('sha256').update(authHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(authHash, expectedHash);
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

/* ── Guard-state cache (ban + session epoch) ─────────────────
 * Checking `is_banned` on every API call adds 50-200 ms. Since bans and
 * session-epoch bumps change rarely, cache the result for 5 minutes.
 * When a participant IS banned the cache is very short-lived (10 s)
 * so the ban takes effect quickly even if a stale entry was cached.
 *
 * `epoch` is the participant's current `session_epoch` (revocation counter,
 * migration 039). `null` means "unknown" - participant deleted, the column is
 * not present yet (deploy/migration skew), or the DB was unreachable - in which
 * case epoch-based revocation is skipped (never fail-closed on epoch alone).
 */
interface GuardState { banned: boolean; epoch: number | null }
const _banCache = new Map<string, { banned: boolean; epoch: number | null; ts: number }>();

async function getGuardState(participantId: string): Promise<GuardState> {
  const cached = _banCache.get(participantId);
  if (cached) {
    const ttl = cached.banned ? BAN_CACHE_TTL_BANNED_MS : BAN_CACHE_TTL_MS;
    if (Date.now() - cached.ts < ttl) return { banned: cached.banned, epoch: cached.epoch };
  }
  const sb = getServiceClient();
  let { data, error } = await sb
    .from('participants')
    .select('is_banned, session_epoch')
    .eq('id', participantId)
    .maybeSingle();

  // Deploy/migration skew: if `session_epoch` doesn't exist yet the select errors.
  // Retry with the always-present `is_banned` column so a missing column can never
  // turn into a fail-closed ban (which would lock everyone out).
  if (error) {
    const fb = await sb
      .from('participants')
      .select('is_banned')
      .eq('id', participantId)
      .maybeSingle();
    if (fb.error) {
      logger.error('Ban check DB error - failing closed (treating as banned)', {
        participantId, error: fb.error.message,
      });
      return { banned: true, epoch: null }; // fail closed: deny access when DB is unreachable
    }
    data = fb.data as typeof data;
    error = null;
  }

  // Participant deleted (self-deletion) - not banned, session is stale
  if (!data) return { banned: false, epoch: null };

  const banned = !!data.is_banned;
  const rawEpoch = (data as { session_epoch?: number }).session_epoch;
  const epoch = typeof rawEpoch === 'number' ? rawEpoch : null;
  boundedSet(_banCache, participantId, { banned, epoch, ts: Date.now() });
  return { banned, epoch };
}

/** Immediately mark a participant as banned in the cache (called from admin routes). */
export function evictBanCache(participantId: string): void {
  _banCache.set(participantId, { banned: true, epoch: null, ts: Date.now() });
}

/**
 * Read a participant's current session epoch, for embedding in a freshly signed
 * token (the `sep` claim). Defaults to `1` when the row/column is absent so both
 * brand-new participants and pre-migration rows get a valid baseline.
 */
export async function getSessionEpoch(participantId: string): Promise<number> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .select('session_epoch')
      .eq('id', participantId)
      .maybeSingle();
    if (error) return 1; // column missing (migration skew) or transient error → safe baseline
    const epoch = (data as { session_epoch?: number } | null)?.session_epoch;
    return typeof epoch === 'number' && epoch > 0 ? epoch : 1;
  } catch {
    return 1;
  }
}

/**
 * Revoke every existing session for a participant by atomically incrementing
 * their session epoch (migration 039). Any JWT signed with an older `sep` fails
 * the secureGuard epoch check. Used for post-ban / logout-everywhere.
 *
 * Fully guarded and non-throwing: a failure here must never break the calling
 * admin action (the action's own effect - e.g. the ban - still stands).
 */
export async function bumpSessionEpoch(participantId: string): Promise<void> {
  try {
    const sb = getServiceClient();
    const { error } = await sb.rpc('increment_session_epoch', { p_participant_id: participantId });
    if (error) {
      logger.warn('Session epoch bump failed', { participantId, error: error.message });
      return;
    }
    _banCache.delete(participantId); // force a fresh epoch read on the next guard check (this instance)
  } catch (err) {
    logger.warn('Session epoch bump threw', {
      participantId, error: err instanceof Error ? err.message : String(err),
    });
  }
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
    .maybeSingle();

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

  // Content-Type guard: any mutating request carrying a body must be JSON.
  // Rejects form-encoded / multipart payloads that could be used for CSRF-style
  // content confusion. (File uploads go straight to Supabase Storage via signed
  // URLs and never pass through this guard, so requiring JSON here is safe.)
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && contentLength && parseInt(contentLength, 10) > 0) {
    const ctype = (req.headers.get('content-type') || '').toLowerCase();
    if (!ctype.includes('application/json')) {
      logger.warn('Unsupported Content-Type', { requestId, route: rateLimitKey, ctype });
      return jsonError('Unsupported Media Type', 415);
    }
  }

  if (!checkCsrf(req)) {
    logger.warn('CSRF check failed', { requestId, route: rateLimitKey });
    return jsonError('Forbidden', 403);
  }

  const session = getSessionFromRequest(req);
  if (!session) return jsonError('Unauthorized', 401);

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimitAsync(`${rateLimitKey}:${ip}`, limit);
  if (!rl.allowed) {
    logger.warn('Rate limited', { requestId, route: rateLimitKey, ip, participantId: session.sub });
    const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    res.headers.set('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
    return res;
  }

  const guardState = await getGuardState(session.sub);
  if (guardState.banned) {
    logger.info('Banned user blocked', { requestId, participantId: session.sub, route: rateLimitKey });
    return jsonError('Account banned', 403);
  }

  // Session revocation: a bumped session_epoch invalidates all tokens issued
  // before the bump (logout-everywhere / post-ban). Enforced only when the token
  // actually carries a `sep` claim and the current epoch is known, so legacy
  // tokens and migration-skew windows are never falsely rejected.
  if (typeof session.sep === 'number' && guardState.epoch !== null && session.sep < guardState.epoch) {
    logger.info('Session revoked (stale epoch)', { requestId, participantId: session.sub, route: rateLimitKey });
    return jsonError('Session expired', 401);
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
