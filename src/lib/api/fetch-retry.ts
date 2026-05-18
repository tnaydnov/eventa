/**
 * fetchWithRetry - resilient fetch for API calls at busy venues.
 *
 * Retries on server errors (5xx) and network failures with exponential backoff + jitter.
 * Does NOT retry on 4xx - those are caller errors (bad input, auth, etc.).
 * Does NOT retry non-idempotent methods (POST/DELETE) unless explicitly opted in,
 * to avoid duplicate mutations.
 *
 * Usage:
 *   const res = await fetchWithRetry('/api/secure/something', { method: 'GET' });
 *
 *   // For idempotent POSTs (e.g. likes - server dedupes by unique constraint):
 *   const res = await fetchWithRetry('/api/secure/likes', { method: 'POST', body: ... },
 *     { retryOnMutations: true });
 */

export interface FetchRetryOptions {
  /** Max number of retry attempts (not counting the first try). Default: 2. */
  retries?: number;
  /** Backoff delays in ms between attempts. Default: [400, 1200]. */
  backoffMs?: number[];
  /** Total timeout per attempt in ms. Default: 12 000. */
  timeout?: number;
  /**
   * If true, also retry POST/DELETE/PATCH on 5xx or network failure.
   * Only use for idempotent mutations (server handles duplicates via unique constraints).
   * Default: false.
   */
  retryOnMutations?: boolean;
}

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const API_TELEMETRY_SAMPLE_RATE = 0.1;

function tryGetEventId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem('ws_session');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { eventId?: unknown };
    return typeof parsed.eventId === 'string' ? parsed.eventId : undefined;
  } catch {
    return undefined;
  }
}

function emitApiTelemetry(payload: {
  metricType: 'api_request' | 'api_error';
  event_id?: string;
  metadata: Record<string, unknown>;
}) {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    metricType: payload.metricType,
    event_id: payload.event_id,
    source: 'unknown',
    metadata: payload.metadata,
  });

  const endpoint = '/api/telemetry/reliability';
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    return;
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => { /* telemetry must never break app flow */ });
}

function shouldTrackApiTelemetry(url: string): boolean {
  if (!url.startsWith('/api/')) return false;
  return !url.startsWith('/api/telemetry/');
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    retries = 2,
    backoffMs = [400, 1_200],
    timeout = 12_000,
    retryOnMutations = false,
  } = options;

  const method = (init.method ?? 'GET').toUpperCase();
  const isReadOnly = method === 'GET' || method === 'HEAD';
  const shouldRetry = isReadOnly || retryOnMutations;
  const shouldTrackTelemetry = shouldTrackApiTelemetry(url);
  const eventId = shouldTrackTelemetry ? tryGetEventId() : undefined;
  const requestStart = shouldTrackTelemetry ? performance.now() : 0;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Merge the caller's signal with our timeout signal
    const signal =
      init.signal
        ? (() => {
            const ac = new AbortController();
            const abort = () => ac.abort();
            init.signal.addEventListener('abort', abort);
            controller.signal.addEventListener('abort', abort);
            return ac.signal;
          })()
        : controller.signal;

    try {
      const res = await fetch(url, { ...init, signal });
      clearTimeout(timeoutId);

      // 4xx - don't retry, return immediately so callers can handle the error
      if (res.status >= 400 && res.status < 500) {
        if (shouldTrackTelemetry) {
          const durationMs = Math.round(performance.now() - requestStart);
          emitApiTelemetry({
            metricType: 'api_error',
            event_id: eventId,
            metadata: {
              url,
              method,
              status: res.status,
              durationMs,
              attempts: attempt + 1,
            },
          });
        }
        return res;
      }

      // Success or final attempt - return as-is
      if (res.ok || attempt === retries || !shouldRetry) {
        if (shouldTrackTelemetry) {
          const durationMs = Math.round(performance.now() - requestStart);
          const sampled = Math.random() < API_TELEMETRY_SAMPLE_RATE;

          if (res.ok && sampled) {
            emitApiTelemetry({
              metricType: 'api_request',
              event_id: eventId,
              metadata: {
                url,
                method,
                status: res.status,
                durationMs,
                attempts: attempt + 1,
              },
            });
          }

          if (!res.ok) {
            emitApiTelemetry({
              metricType: 'api_error',
              event_id: eventId,
              metadata: {
                url,
                method,
                status: res.status,
                durationMs,
                attempts: attempt + 1,
              },
            });
          }
        }

        return res;
      }

      // 5xx retriable - fall through to backoff
      if (!RETRIABLE_STATUS.has(res.status)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      if (shouldTrackTelemetry && (attempt === retries || !shouldRetry)) {
        const durationMs = Math.round(performance.now() - requestStart);
        emitApiTelemetry({
          metricType: 'api_error',
          event_id: eventId,
          metadata: {
            url,
            method,
            status: 0,
            durationMs,
            attempts: attempt + 1,
            reason: err instanceof Error ? err.message : 'network_error',
          },
        });
      }

      // If caller aborted - don't retry
      if (init.signal?.aborted) throw err;

      // Final attempt - propagate
      if (attempt === retries || !shouldRetry) throw err;
    }

    // Exponential backoff with ±25% jitter
    const base = backoffMs[attempt] ?? backoffMs[backoffMs.length - 1];
    const delay = base * (0.75 + Math.random() * 0.5);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw lastError;
}
