/**
 * Unit tests for lib/resilience.ts - timeout, retry, circuit breaker.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withTimeout,
  withRetry,
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  callExternal,
  getCircuitBreaker,
  _resetCircuitBreakers,
} from '@/lib/resilience';

const noSleep = () => Promise.resolve();

beforeEach(() => {
  _resetCircuitBreakers();
});

describe('withTimeout', () => {
  it('resolves when the operation completes in time', async () => {
    const result = await withTimeout(async () => 'ok', 1000, 'fast');
    expect(result).toBe('ok');
  });

  it('throws TimeoutError when the operation exceeds the deadline', async () => {
    await expect(
      withTimeout(
        (signal) => new Promise((_resolve, reject) => {
          // Honour the abort signal like fetch would.
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
        10,
        'slow',
      ),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes an AbortSignal that fires on timeout', async () => {
    let abortFired = false;
    await withTimeout(
      (signal) => new Promise((resolve) => {
        signal.addEventListener('abort', () => { abortFired = true; resolve(undefined); });
      }),
      10,
      'sig',
    ).catch(() => { /* expected */ });
    expect(abortFired).toBe(true);
  });

  it('propagates a non-timeout error unchanged', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(async () => { throw boom; }, 1000)).rejects.toBe(boom);
  });
});

describe('withRetry', () => {
  it('returns the first successful result without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries up to the configured count then throws the last error', async () => {
    const err = new Error('fail');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('succeeds on a later attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce('second');
    const result = await withRetry(fn, { retries: 3, sleep: noSleep });
    expect(result).toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry when isRetryable returns false', async () => {
    const err = new Error('permanent');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { retries: 5, sleep: noSleep, isRetryable: () => false }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a CircuitOpenError by default', async () => {
    const fn = vi.fn().mockRejectedValue(new CircuitOpenError('open'));
    await expect(withRetry(fn, { retries: 5, sleep: noSleep })).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies backoff delays via the injected sleep', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    await withRetry(fn, {
      retries: 2,
      baseDelayMs: 100,
      factor: 2,
      jitter: false,
      sleep: (ms) => { delays.push(ms); return Promise.resolve(); },
    }).catch(() => { /* expected */ });
    expect(delays).toEqual([100, 200]);
  });
});

describe('CircuitBreaker', () => {
  it('starts closed and passes calls through', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 3 });
    expect(cb.state).toBe('closed');
    await expect(cb.execute(async () => 'ok')).resolves.toBe('ok');
  });

  it('opens after the failure threshold of consecutive failures', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 2, cooldownMs: 1000 });
    await cb.execute(async () => { throw new Error('1'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('2'); }).catch(() => {});
    expect(cb.state).toBe('open');
    // Now fails fast without invoking the function.
    const fn = vi.fn();
    await expect(cb.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('a success resets the consecutive-failure counter', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 2 });
    await cb.execute(async () => { throw new Error('1'); }).catch(() => {});
    await cb.execute(async () => 'ok'); // resets
    await cb.execute(async () => { throw new Error('2'); }).catch(() => {});
    expect(cb.state).toBe('closed'); // only 1 failure since reset
  });

  it('transitions open → half-open after the cooldown elapses', async () => {
    let clock = 1000;
    const cb = new CircuitBreaker('t', { failureThreshold: 1, cooldownMs: 500, now: () => clock });
    await cb.execute(async () => { throw new Error('boom'); }).catch(() => {});
    expect(cb.state).toBe('open');
    clock += 600; // past cooldown
    expect(cb.state).toBe('half-open');
  });

  it('a successful half-open probe closes the circuit', async () => {
    let clock = 1000;
    const cb = new CircuitBreaker('t', { failureThreshold: 1, cooldownMs: 500, now: () => clock });
    await cb.execute(async () => { throw new Error('boom'); }).catch(() => {});
    clock += 600;
    await cb.execute(async () => 'recovered');
    expect(cb.state).toBe('closed');
  });

  it('a failed half-open probe re-opens the circuit', async () => {
    let clock = 1000;
    const cb = new CircuitBreaker('t', { failureThreshold: 1, cooldownMs: 500, now: () => clock });
    await cb.execute(async () => { throw new Error('boom'); }).catch(() => {});
    clock += 600;
    expect(cb.state).toBe('half-open');
    await cb.execute(async () => { throw new Error('again'); }).catch(() => {});
    expect(cb.state).toBe('open');
  });
});

describe('getCircuitBreaker registry', () => {
  it('returns the same instance for the same name', () => {
    const a = getCircuitBreaker('shared');
    const b = getCircuitBreaker('shared');
    expect(a).toBe(b);
  });
});

describe('callExternal', () => {
  it('returns the operation result on success', async () => {
    const result = await callExternal('p', async () => 'ok', { sleep: noSleep });
    expect(result).toBe('ok');
  });

  it('retries a failing operation and can eventually succeed', async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');
    const result = await callExternal('p', op, { retries: 2, sleep: noSleep });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('fails fast (no retry) once the breaker is open', async () => {
    const op = vi.fn().mockRejectedValue(new Error('down'));
    // Open the breaker with a low threshold and no retries.
    await callExternal('flaky', op, { retries: 0, breaker: { failureThreshold: 1 }, sleep: noSleep }).catch(() => {});
    op.mockClear();
    // Next call should be rejected by the open circuit without calling op.
    await expect(
      callExternal('flaky', op, { retries: 3, breaker: { failureThreshold: 1 }, sleep: noSleep }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(op).not.toHaveBeenCalled();
  });

  it('honours the per-attempt timeout', async () => {
    await expect(
      callExternal(
        'slow',
        (signal) => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
        { timeoutMs: 10, retries: 0, sleep: noSleep },
      ),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
