/**
 * Unit tests for lib/logger.ts - Structured logger
 * Tests: U-LOG-01 through U-LOG-06+
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('U-LOG-01: logger.info calls console.info', () => {
    logger.info('test message', { foo: 'bar' });
    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    expect(output).toContain('test message');
  });

  it('U-LOG-02: logger.error calls console.error', () => {
    logger.error('error message', { code: 500 });
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('error message');
  });

  it('U-LOG-03: logger.warn calls console.warn', () => {
    logger.warn('warning message');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('U-LOG-04: logger.debug calls console.debug', () => {
    logger.debug('debug message');
    expect(debugSpy).toHaveBeenCalled();
  });

  it('U-LOG-05: handles Error objects in meta', () => {
    const err = new Error('test error');
    logger.error('something failed', err);
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('something failed');
    expect(output).toContain('test error');
  });

  it('U-LOG-06: child logger includes base meta', () => {
    const childLog = logger.child({ route: '/api/test' });
    childLog.info('child message');
    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    expect(output).toContain('child message');
    expect(output).toContain('/api/test');
  });

  it('child logger can be nested', () => {
    const childLog = logger.child({ route: '/api/test' });
    const grandchild = childLog.child({ requestId: 'abc' });
    grandchild.info('nested message');
    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls[0][0] as string;
    expect(output).toContain('nested message');
    expect(output).toContain('/api/test');
    expect(output).toContain('abc');
  });

  it('handles null meta', () => {
    expect(() => logger.info('message', null)).not.toThrow();
  });

  it('handles undefined meta', () => {
    expect(() => logger.info('message', undefined)).not.toThrow();
  });

  it('handles primitive meta', () => {
    expect(() => logger.info('message', 42 as any)).not.toThrow();
  });

  it('handles array meta', () => {
    expect(() => logger.info('message', [1, 2, 3] as any)).not.toThrow();
  });

  it('output contains level label in dev', () => {
    logger.info('check format');
    const output = infoSpy.mock.calls[0][0] as string;
    expect(output).toContain('INFO');
  });

  it('output includes additional meta properties', () => {
    logger.info('with meta', { userId: '123', action: 'login' });
    const output = infoSpy.mock.calls[0][0] as string;
    expect(output).toContain('userId');
    expect(output).toContain('123');
  });

  // ── PII / secret redaction ──────────────────────────────────────
  describe('redaction', () => {
    it('masks the value of a sensitive key (otp)', () => {
      logger.info('verify', { otp: '123456' });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('123456');
      expect(output).toContain('redacted');
    });

    it('masks sensitive keys: phone, token, password, authorization', () => {
      logger.info('sensitive', {
        phone: '+972501234567',
        token: 'abcdef123456',
        password: 'hunter2pass',
        authorization: 'Bearer xyz',
      });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('+972501234567');
      expect(output).not.toContain('abcdef123456');
      expect(output).not.toContain('hunter2pass');
      expect(output).not.toContain('Bearer xyz');
    });

    it('masks an email inside a NON-sensitive key, keeping the domain', () => {
      logger.info('note', { note: 'reach me at john.doe@example.com please' });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('john.doe@example.com');
      expect(output).toContain('@example.com');
    });

    it('masks a phone number inside a NON-sensitive key, keeping last 2 digits', () => {
      logger.info('note', { note: 'call 0501234567 now' });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('0501234567');
      expect(output).toContain('***67');
    });

    it('masks PII embedded in the log message itself', () => {
      logger.warn('OTP sent to 0521112233');
      const output = warnSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('0521112233');
    });

    it('does NOT mangle UUIDs (no false phone match across hyphens)', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      logger.info('lookup', { participantId: uuid });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).toContain(uuid);
    });

    it('preserves short non-sensitive values and ids', () => {
      logger.info('ctx', { status: 200, route: '/api/secure/likes', requestId: 'a1b2c3d4' });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).toContain('200');
      expect(output).toContain('/api/secure/likes');
      expect(output).toContain('a1b2c3d4');
    });
  });
});
