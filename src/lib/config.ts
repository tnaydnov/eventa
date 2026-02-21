/**
 * Application configuration — tunable runtime settings.
 *
 * Unlike constants.ts (which holds domain labels, enum arrays, and
 * fixed validation limits), this file centralises operational knobs
 * that may differ between environments or be tweaked over time.
 *
 * All values have sensible defaults; override via environment variables
 * where noted.
 */

// ─── Session & Auth ─────────────────────────────────────────

/** Session JWT lifetime in seconds (default 30 days). */
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Admin JWT lifetime in seconds (default 24 hours). */
export const ADMIN_MAX_AGE_S = 24 * 60 * 60;

/** JWT issuer claim (for iss field). */
export const JWT_ISSUER = 'eventa.productions';

/** JWT audience claim (for aud field). */
export const JWT_AUDIENCE = 'eventa-app';

// ─── Cache TTLs ─────────────────────────────────────────────

/** Ban-check cache TTL for non-banned users (ms). */
export const BAN_CACHE_TTL_MS = 5 * 60 * 1000;

/** Ban-check cache TTL for banned users — short so bans take effect fast (ms). */
export const BAN_CACHE_TTL_BANNED_MS = 10_000;

/** Event-status cache TTL for active/ended events (ms). */
export const EVENT_STATUS_CACHE_TTL_ACTIVE_MS = 5 * 60 * 1000;

/** Event-status cache TTL for paused/archived/draft events (ms). */
export const EVENT_STATUS_CACHE_TTL_INACTIVE_MS = 30_000;

/** Maximum entries in any in-memory cache Map before eviction. */
export const MAX_CACHE_SIZE = 5_000;

// ─── Order / Contact form ───────────────────────────────────

/** Maximum length for order form text fields. */
export const ORDER_NAME_MAX_LENGTH = 100;
export const ORDER_PHONE_MAX_LENGTH = 30;
export const ORDER_EMAIL_MAX_LENGTH = 254;
