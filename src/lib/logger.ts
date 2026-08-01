/**
 * Structured logger for server-side API routes.
 *
 * Outputs JSON lines in production for log-drain ingestion (Datadog, etc.).
 * In development, outputs human-readable coloured text.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Photo uploaded', { participantId, photoId });
 *   logger.warn('Rate limited', { ip, route });
 *   logger.error('DB error', { error, route });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = process.env.LOG_LEVEL as LogLevel || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const IS_PROD = process.env.NODE_ENV === 'production';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (IS_PROD) {
    // JSON lines for log drains
    return JSON.stringify(entry);
  }
  // Human-readable for dev
  const { level, msg, ts, ...rest } = entry;
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `[${level.toUpperCase()}] ${msg}${extra}`;
}

type LogMeta = Record<string, unknown> | unknown;

/* ── PII / secret redaction ──────────────────────────────────────────
 * Logs are shipped to stdout (Vercel) and, in future, a log drain. This app
 * handles special-category data (phones, OTPs, emails, message text), so we
 * scrub sensitive values centrally here - every logger call is covered, and
 * no individual call site has to remember to redact.
 *
 * Two complementary strategies:
 *   1. Key-based: any object key whose name looks sensitive has its value masked.
 *   2. Pattern-based: email and phone-number shapes are masked inside ANY string
 *      value (catches PII that leaks through error messages, URLs, etc.).
 */

/** Object keys whose values must never be logged in the clear. */
const SENSITIVE_KEY_RE =
  /(pass(word|wd)?|secret|token|cookie|authorization|^auth$|otp|\bcode\b|phone|e?mail|\bbio\b|message|\btext\b|content|body|idempotency|fingerprint|jwt|session)/i;

/** Email addresses - mask the local part, keep the domain for debugging. */
const EMAIL_RE = /([\w.+-])[\w.+-]*(@[\w.-]+\.\w+)/g;

/**
 * Phone-shaped runs of 7–14 digits (optional + and separators), bounded by
 * non-word / non-hyphen chars so UUID segments (which are hyphen-delimited)
 * are never mistaken for phone numbers.
 */
const PHONE_RE = /(?<![\w-])(\+?\d[\d\s().-]{5,12}\d)(?![\w-])/g;

const MAX_STRING_LEN = 2_000;
const MAX_REDACT_DEPTH = 6;

/** Mask phone/email patterns inside a free-text string. */
function maskPatterns(value: string): string {
  let out = value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…[truncated]` : value;
  out = out.replace(EMAIL_RE, (_m, first, domain) => `${first}***${domain}`);
  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 7) return m; // not actually phone-like
    return `***${digits.slice(-2)}`; // keep last 2 digits for correlation
  });
  return out;
}

/** Mask a value flagged as sensitive by its key name. */
function maskSensitive(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= 4) return '[redacted]';
    return `${value.slice(0, 2)}…[redacted]`; // short prefix aids correlation
  }
  if (typeof value === 'number' || typeof value === 'boolean') return '[redacted]';
  return value === null || value === undefined ? value : '[redacted]';
}

/** Recursively redact a log-meta object. Returns a new object (never mutates). */
function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth >= MAX_REDACT_DEPTH) return '[depth-limit]';
  if (typeof value === 'string') return maskPatterns(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? maskSensitive(v) : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Normalize the meta argument.
 * - If it's a Record, spread it directly.
 * - If it's an Error, extract message + stack.
 * - Otherwise wrap in { data: meta }.
 */
function normalizeMeta(meta: LogMeta): Record<string, unknown> {
  if (meta == null) return {};
  if (meta instanceof Error) return { error: meta.message, stack: meta.stack };
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, unknown>;
  return { data: meta };
}

function log(level: LogLevel, msg: string, meta?: LogMeta): void {
  if (!shouldLog(level)) return;

  // Redact PII/secrets from both the message and the structured meta before output.
  // `stack` is preserved as-is (file paths/line numbers, not PII) but still pattern-masked.
  const safeMeta = redact(normalizeMeta(meta)) as Record<string, unknown>;
  const entry: LogEntry = {
    level,
    msg: maskPatterns(msg),
    ts: new Date().toISOString(),
    ...safeMeta,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * Create a child logger with pre-bound context (e.g. route, requestId).
 *
 * Usage:
 *   const log = logger.child({ route: '/api/secure/photos', requestId });
 *   log.info('Upload complete');
 */
function child(baseMeta: Record<string, unknown>) {
  return {
    debug: (msg: string, meta?: LogMeta) => log('debug', msg, { ...baseMeta, ...normalizeMeta(meta) }),
    info: (msg: string, meta?: LogMeta) => log('info', msg, { ...baseMeta, ...normalizeMeta(meta) }),
    warn: (msg: string, meta?: LogMeta) => log('warn', msg, { ...baseMeta, ...normalizeMeta(meta) }),
    error: (msg: string, meta?: LogMeta) => log('error', msg, { ...baseMeta, ...normalizeMeta(meta) }),
    child: (extraMeta: Record<string, unknown>) => child({ ...baseMeta, ...extraMeta }),
  };
}

export const logger = {
  debug: (msg: string, meta?: LogMeta) => log('debug', msg, meta),
  info: (msg: string, meta?: LogMeta) => log('info', msg, meta),
  warn: (msg: string, meta?: LogMeta) => log('warn', msg, meta),
  error: (msg: string, meta?: LogMeta) => log('error', msg, meta),
  child,
};
