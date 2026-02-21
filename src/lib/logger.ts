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

  const entry: LogEntry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...normalizeMeta(meta),
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
