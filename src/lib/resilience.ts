/**
 * Resilience primitives for calling external providers (SMS, email, payment, moderation).
 *
 * On Vercel each function invocation has a hard 15 s budget. A single slow or hung
 * provider can therefore consume the entire budget and cascade into user-visible
 * failures. These helpers bound that blast radius:
 *
 *   - `withTimeout`  - abort an operation that exceeds a deadline (frees the budget).
 *   - `withRetry`    - retry transient failures with exponential backoff + jitter.
 *   - `CircuitBreaker` - stop hammering a provider that is already failing; fail fast
 *                        for a cool-down window, then probe once to recover.
 *   - `callExternal` - compose all three with sensible defaults.
 *
 * All helpers are dependency-free and deterministic under test (clock and sleep are
 * injectable). They never import app modules, so they are safe to use anywhere.
 *
 * NOTE on serverless: a CircuitBreaker's state lives in module memory and is therefore
 * per-instance, not global. That is still valuable (a hot instance stops retrying a
 * dead provider) but is not a distributed breaker. Keep timeouts as the primary guard.
 */

/** Thrown when an operation exceeds its timeout. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Thrown by a CircuitBreaker when it is open and rejecting calls. */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Run `operation` with an abort deadline. The operation receives an `AbortSignal`
 * it should pass to `fetch` (or otherwise honour) so the work is actually cancelled,
 * not just abandoned. Throws `TimeoutError` if the deadline elapses first.
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label = 'operation',
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (err) {
    // Surface a clear TimeoutError when the abort was ours, not a caller-side abort.
    if (controller.signal.aborted) {
      throw new TimeoutError(`${label} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Default: retry anything except an open circuit (which should fail fast). */
const defaultRetryable = (err: unknown) => !(err instanceof CircuitOpenError);

export interface RetryOptions {
  /** Additional attempts after the first (default 2 → up to 3 total tries). */
  retries?: number;
  /** Base backoff delay in ms (default 200). */
  baseDelayMs?: number;
  /** Maximum backoff delay in ms (default 2000). */
  maxDelayMs?: number;
  /** Exponential factor (default 2). */
  factor?: number;
  /** Apply 50–100% randomised jitter to each delay (default true) to avoid thundering herds. */
  jitter?: boolean;
  /** Decide whether a thrown error is worth retrying (default: everything except CircuitOpenError). */
  isRetryable?: (err: unknown) => boolean;
  /** Observability hook fired before each retry sleep. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Retry `fn` with exponential backoff + jitter until it succeeds, the retry budget is
 * exhausted, or the error is deemed non-retryable. Re-throws the last error on failure.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 200,
    maxDelayMs = 2000,
    factor = 2,
    jitter = true,
    isRetryable = defaultRetryable,
    onRetry,
    sleep = defaultSleep,
  } = opts;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, attempt));
      // Jitter to 50–100% of the computed backoff so many clients don't retry in lockstep.
      const delay = jitter ? Math.round(backoff * (0.5 + Math.random() / 2)) : backoff;
      onRetry?.(err, attempt + 1, delay);
      await sleep(delay);
      attempt++;
    }
  }
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens (default 5). */
  failureThreshold?: number;
  /** How long the circuit stays open before allowing a single probe (default 30 000 ms). */
  cooldownMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

/**
 * A minimal consecutive-failure circuit breaker.
 *
 *   closed     → calls flow; N consecutive failures opens the circuit.
 *   open        → calls fail fast with CircuitOpenError until the cooldown elapses.
 *   half-open  → one probe call is allowed; success closes, failure re-opens.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private _state: CircuitState = 'closed';
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(public readonly name: string, opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
    this.now = opts.now ?? Date.now;
  }

  /** Current state, accounting for an elapsed cooldown (open → half-open). */
  get state(): CircuitState {
    if (this._state === 'open' && this.now() - this.openedAt >= this.cooldownMs) {
      this._state = 'half-open';
    }
    return this._state;
  }

  /** Run `fn` through the breaker. Throws CircuitOpenError when open. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new CircuitOpenError(`Circuit "${this.name}" is open`);
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private recordSuccess(): void {
    this.failures = 0;
    this._state = 'closed';
  }

  private recordFailure(): void {
    this.failures++;
    // A failed half-open probe, or crossing the threshold, (re)opens the circuit.
    if (this._state === 'half-open' || this.failures >= this.failureThreshold) {
      this._state = 'open';
      this.openedAt = this.now();
    }
  }

  /** Force the breaker back to a clean closed state. */
  reset(): void {
    this.failures = 0;
    this._state = 'closed';
    this.openedAt = 0;
  }
}

/** Process-local registry so one provider name maps to one breaker instance. */
const _breakers = new Map<string, CircuitBreaker>();

/** Get (or lazily create) the shared CircuitBreaker for a provider name. */
export function getCircuitBreaker(name: string, opts?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = _breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, opts);
    _breakers.set(name, breaker);
  }
  return breaker;
}

/** Test-only: clear the breaker registry. */
export function _resetCircuitBreakers(): void {
  _breakers.clear();
}

export interface ResilientCallOptions extends RetryOptions {
  /** Per-attempt timeout in ms (default 10 000). */
  timeoutMs?: number;
  /** Circuit-breaker config, or `false` to disable the breaker for this call. */
  breaker?: CircuitBreakerOptions | false;
}

/**
 * Call an external provider with timeout + circuit breaker + retry composed together.
 *
 * Order per attempt: breaker gate → timeout-bounded operation. The whole thing is then
 * wrapped in retry (which skips retrying when the breaker is open, so we fail fast).
 *
 * @param name      Stable provider key (used for the breaker registry), e.g. 'textme-sms'.
 * @param operation Receives an AbortSignal to wire into fetch.
 */
export async function callExternal<T>(
  name: string,
  operation: (signal: AbortSignal) => Promise<T>,
  opts: ResilientCallOptions = {},
): Promise<T> {
  const { timeoutMs = 10_000, breaker, ...retryOpts } = opts;

  const runOnce = () => {
    const exec = () => withTimeout(operation, timeoutMs, name);
    return breaker === false ? exec() : getCircuitBreaker(name, breaker).execute(exec);
  };

  return withRetry(runOnce, {
    ...retryOpts,
    isRetryable: retryOpts.isRetryable ?? defaultRetryable,
  });
}
