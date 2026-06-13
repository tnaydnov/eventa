/**
 * Application configuration - tunable runtime settings.
 *
 * Unlike constants.ts (which holds domain labels, enum arrays, and
 * fixed validation limits), this file centralises operational knobs
 * that may differ between environments or be tweaked over time.
 *
 * All values have sensible defaults; override via environment variables
 * where noted.
 */

// ─── Session & Auth ─────────────────────────────────────────

/**
 * JWT signing secret - required for both admin and session tokens.
 * Lazy getter: evaluated on first call, not at import time.
 * This prevents the build from crashing when JWT_SECRET isn't in the
 * build-time environment (Vercel only injects it at runtime).
 */
let _jwtSecret: string | null = null;
export function getJwtSecret(): string {
  if (_jwtSecret !== null) return _jwtSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  _jwtSecret = secret;
  return secret;
}
/** @deprecated Use getJwtSecret() - kept for backwards compat during migration */
export const JWT_SECRET = '' as string;

/** Whether the app is running in production mode. */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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

/** Ban-check cache TTL for banned users - short so bans take effect fast (ms). */
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

// ─── OTP Configuration ──────────────────────────────────────

/** Number of digits in the OTP code. */
export const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);

/** OTP expiry in seconds (default 5 minutes). */
export const OTP_EXPIRY_S = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);

/** Maximum verification attempts per OTP code. */
export const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

/** Minimum seconds between OTP resend requests. */
export const OTP_RESEND_COOLDOWN_S = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

/**
 * Toll-fraud guards for OTP/SMS sending (SMS pumping protection).
 * These complement the per-IP rate limit and per-phone cooldown.
 */
/** Max OTP sends per phone per rolling hour. Generous for legit use, blocks pumping. */
export const OTP_MAX_PER_PHONE_PER_HOUR = parseInt(process.env.OTP_MAX_PER_PHONE_PER_HOUR || '8', 10);
/**
 * Optional GLOBAL cap on OTP sends per rolling 24h across ALL phones — a backstop
 * that bounds the blast radius (and cost) of a mass SMS-pumping attack.
 * `0` disables it (default) so it can never block a legitimately busy event until
 * an operator tunes it for their expected volume.
 */
export const OTP_GLOBAL_MAX_PER_DAY = parseInt(process.env.OTP_GLOBAL_MAX_PER_DAY || '0', 10);

// ─── Messaging Configuration ────────────────────────────────

/** Base URL for building join/feedback links. */
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eventa.productions';

/** Whether the SMS provider is live (true) or using stubs (false). */
export const SMS_PROVIDER_LIVE = process.env.SMS_PROVIDER_LIVE === 'true';

/** Maximum guest phones per event. */
export const MAX_GUEST_PHONES_PER_EVENT = 10_000;

/** Maximum length for guest name in guest phone list. */
export const MAX_GUEST_NAME_LENGTH = 100;

// ─── Messaging Timing ───────────────────────────────────────

/** Centralised timing constants for cron-driven messaging. */
export const MSG_TIMING = {
  /** Hours before event start to send pre-event messages. */
  PRE_EVENT_HOURS_BEFORE: 3,
  /** Hours after event end to send feedback messages. */
  FEEDBACK_HOURS_AFTER: 12,
  /** Days before event to send upload-reminder emails (descending). */
  UPLOAD_REMINDER_DAYS: [7, 3] as const,
} as const;

// ─── Feature Flags ──────────────────────────────────────────

/** Whether phone verification is required on the join page (default true). */
export const PHONE_VERIFICATION_ENABLED =
  process.env.NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED !== 'false';

// ─── Payment Configuration ──────────────────────────────────

/** Whether the payment provider is live (true) or using stubs (false). */
export const PAYMENT_PROVIDER_LIVE = process.env.PAYMENT_PROVIDER_LIVE === 'true';

/** Base event package price in shekels (includes all features). */
export const BASE_PRICE = 300;

/** Guest messaging add-on price in shekels (now included in base - kept for backward compat). */
export const MSG_ADDON = 0;

/** Number of days a payment link stays valid before expiring. */
export const PAYMENT_LINK_EXPIRY_DAYS = 7;

// ─── Supabase ───────────────────────────────────────────────

/** Supabase service-role key for server-side admin operations. */
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Invoice4U Configuration ────────────────────────────────

/** Invoice4U SOAP API endpoint (override for staging/testing). */
export const INVOICE4U_API_URL =
  process.env.INVOICE4U_API_URL || 'https://api.invoice4u.co.il/Services/ApiService.svc';

/** Invoice4U API GUID token. */
export const INVOICE4U_API_TOKEN = process.env.INVOICE4U_API_TOKEN || '';

/**
 * Calculate the total price in agorot (shekel × 100).
 * Price is now flat ₪300 regardless of messaging choice.
 */
export function calculateTotalPrice(_wantsGuestMessages: boolean): number {
  return BASE_PRICE * 100; // agorot
}
