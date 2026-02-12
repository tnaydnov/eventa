/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach per IP.
 *
 * ⚠️ PRODUCTION NOTE: This in-memory store does NOT persist across
 * serverless function instances (e.g. Vercel). Each cold start gets
 * a fresh Map. For production, replace with a distributed store like
 * Upstash Redis (@upstash/ratelimit) or Vercel KV.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
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
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const entry = store.get(identifier) || { timestamps: [] };

  // Remove old timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < config.windowMs
  );

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const resetMs = config.windowMs - (now - oldest);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  store.set(identifier, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: 0,
  };
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
