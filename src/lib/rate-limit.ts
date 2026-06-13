/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach per IP.
 *
 * ⚠️ The in-memory store does NOT persist across serverless function instances
 * (e.g. Vercel). Each cold start gets a fresh Map. For true cross-instance limits,
 * set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN and call the async
 * `checkRateLimitAsync()` - it transparently uses a distributed Redis sliding
 * window and falls back to this in-memory limiter if Redis is unreachable.
 */

interface RateLimitEntry {
  timestamps: number[];
  windowMs: number; // track which window this key uses
}

/** Result shape shared by the sync (in-memory) and async (distributed) limiters. */
export interface RateLimitResult {
  /** `true` if the request is ALLOWED, `false` if rate-limited. */
  allowed: boolean;
  /** Approximate remaining requests in the current window. */
  remaining: number;
  /** Milliseconds until the window frees up (used for the `Retry-After` header). */
  resetMs: number;
}

const store = new Map<string, RateLimitEntry>();

// Cap the store size to prevent memory exhaustion under attack
const MAX_STORE_SIZE = 10_000;

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 300_000);
}

export interface RateLimitConfig {
  /** Max requests in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000, // 1 minute
};

/**
 * Check if a request should be rate limited.
 * @returns `true` if the request is ALLOWED, `false` if rate-limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier) || { timestamps: [], windowMs: config.windowMs };

  // Remove old timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < config.windowMs
  );
  entry.windowMs = config.windowMs;

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const resetMs = config.windowMs - (now - oldest);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  store.set(identifier, entry);

  // Evict oldest entries if store is too large (DDoS protection)
  if (store.size > MAX_STORE_SIZE) {
    const keysIter = store.keys();
    // Delete ~10% of oldest entries
    for (let i = 0; i < MAX_STORE_SIZE * 0.1; i++) {
      const { value, done } = keysIter.next();
      if (done) break;
      store.delete(value);
    }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: 0,
  };
}

/* ════════════════════════════════════════════════════════════════════
   Distributed limiter (Upstash Redis REST) - optional, opt-in via env.
   ────────────────────────────────────────────────────────────────────
   Activated automatically when UPSTASH_REDIS_REST_URL + _TOKEN are set.
   Implemented as a sorted-set sliding window (same algorithm as the
   in-memory limiter) over Upstash's REST pipeline API - no extra npm
   dependency, no persistent connection (ideal for serverless).
   On ANY Redis error it degrades gracefully to the in-memory limiter so a
   limiter outage never takes down the API (and never fully removes limits).
   ════════════════════════════════════════════════════════════════════ */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const UPSTASH_TIMEOUT_MS = 2_000;

/** True when a distributed backend is configured. */
export function isDistributedRateLimitEnabled(): boolean {
  return !!(UPSTASH_URL && UPSTASH_TOKEN);
}

/** Execute a pipeline of Redis commands via the Upstash REST API. */
async function upstashPipeline(commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    // Never let a slow limiter stall the request path.
    signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const json = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  return json.map((r) => {
    if (r.error) throw new Error(`Upstash cmd error: ${r.error}`);
    return r.result;
  });
}

/** Distributed sliding-window check backed by a Redis sorted set. */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  // Member must be unique per request so concurrent requests in the same ms
  // don't collide in the sorted set.
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  const results = await upstashPipeline([
    ['ZREMRANGEBYSCORE', key, 0, windowStart], // drop entries older than the window
    ['ZADD', key, now, member],                // record this request
    ['ZCARD', key],                            // count requests in the window
    ['PEXPIRE', key, config.windowMs],         // auto-expire the key when idle
    ['ZRANGE', key, 0, 0],                     // oldest remaining member (its name encodes the timestamp)
  ]);

  const count = Number(results[2] ?? 0);
  const allowed = count <= config.maxRequests;

  // Compute the ACTUAL remaining ms until the oldest entry exits the window.
  // Member names are `${timestamp}-${random}`, so we can extract the timestamp
  // without WITHSCORES (avoids compatibility issues with older Redis versions).
  let resetMs = 0;
  if (!allowed) {
    const rangeResult = results[4] as string[] | null;
    const firstMember = Array.isArray(rangeResult) ? rangeResult[0] : (rangeResult as unknown as string | null);
    // member format: "1700000000000-abc123"
    const oldestScore = firstMember ? Number(String(firstMember).split('-')[0]) : now;
    const expiresAt = (isNaN(oldestScore) ? now : oldestScore) + config.windowMs;
    resetMs = Math.max(1, expiresAt - now);
  }

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - count),
    resetMs,
  };
}

/**
 * Rate-limit check that prefers a distributed (cross-instance) backend.
 *
 * Use this on abuse-prone, cross-instance-sensitive endpoints (auth, OTP, order,
 * payments, all participant `secureGuard` calls). When Upstash isn't configured -
 * or is temporarily unreachable - it transparently falls back to the per-instance
 * in-memory limiter, so behaviour is always safe and never throws.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  if (isDistributedRateLimitEnabled()) {
    try {
      return await checkRateLimitRedis(identifier, config);
    } catch {
      // Degrade to in-memory rather than failing open: still some protection
      // per instance, and never blocks legitimate traffic on a limiter outage.
    }
  }
  return checkRateLimit(identifier, config);
}

/**
 * Get client IP from request headers (works with Vercel, Cloudflare, etc.)
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/** Pre-configured rate limit configs */
export const RATE_LIMITS = {
  /** Standard API calls (30/min) */
  standard: { maxRequests: 30, windowMs: 60_000 } satisfies RateLimitConfig,
  /** Auth / login attempts (5/min) */
  auth: { maxRequests: 5, windowMs: 60_000 } satisfies RateLimitConfig,
  /** File uploads (10/min) */
  upload: { maxRequests: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** Strict for abuse prevention (3/min) */
  strict: { maxRequests: 3, windowMs: 60_000 } satisfies RateLimitConfig,
};
