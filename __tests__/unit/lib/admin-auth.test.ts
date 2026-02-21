/**
 * Unit tests for lib/admin-auth.ts — Admin Auth
 * Tests: U-ADM-01 through U-ADM-13
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signAdminToken,
  verifyAdminToken,
  adminCookieHeader,
  clearAdminCookieHeader,
  getAdminTokenFromRequest,
  verifyAdminFromRequest,
  adminAuditLog,
} from '@/lib/admin-auth';
import { ADMIN_MAX_AGE_S } from '@/lib/config';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
  process.env.NODE_ENV = 'test';
});

describe('signAdminToken', () => {
  it('U-ADM-01: returns JWT with admin role', () => {
    const token = signAdminToken();
    const parts = token.split('.');
    expect(parts.length).toBe(3);
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.role).toBe('admin');
  });

  it('U-ADM-02: expiry matches ADMIN_MAX_AGE_S', () => {
    const token = signAdminToken();
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.exp - payload.iat).toBe(ADMIN_MAX_AGE_S);
  });

  it('includes issuer and audience', () => {
    const token = signAdminToken();
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.iss).toBe('eventa.productions');
    expect(payload.aud).toBe('eventa-app');
  });
});

describe('verifyAdminToken', () => {
  it('U-ADM-03: verifies a valid token', () => {
    const token = signAdminToken();
    expect(verifyAdminToken(token)).toBe(true);
  });

  it('U-ADM-04: rejects expired token', () => {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = {
      role: 'admin',
      iss: 'eventa.productions',
      aud: 'eventa-app',
      iat: Math.floor(Date.now() / 1000) - 100000,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${body}`).digest('base64url');

    expect(verifyAdminToken(`${header}.${body}.${sig}`)).toBe(false);
  });

  it('U-ADM-05: rejects null and undefined', () => {
    expect(verifyAdminToken(null)).toBe(false);
    expect(verifyAdminToken(undefined)).toBe(false);
  });

  it('U-ADM-06: rejects tampered token', () => {
    const token = signAdminToken();
    expect(verifyAdminToken(token + 'x')).toBe(false);
  });

  it('rejects token with wrong role', () => {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = {
      role: 'user', // wrong role
      iss: 'eventa.productions',
      aud: 'eventa-app',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${body}`).digest('base64url');

    expect(verifyAdminToken(`${header}.${body}.${sig}`)).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(verifyAdminToken('')).toBe(false);
    expect(verifyAdminToken('abc')).toBe(false);
    expect(verifyAdminToken('a.b')).toBe(false);
  });

  it('rejects token with wrong issuer', () => {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = {
      role: 'admin',
      iss: 'wrong-issuer',
      aud: 'eventa-app',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${body}`).digest('base64url');

    expect(verifyAdminToken(`${header}.${body}.${sig}`)).toBe(false);
  });

  it('rejects token with wrong audience', () => {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = {
      role: 'admin',
      iss: 'eventa.productions',
      aud: 'wrong-audience',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${body}`).digest('base64url');

    expect(verifyAdminToken(`${header}.${body}.${sig}`)).toBe(false);
  });
});

describe('adminCookieHeader', () => {
  it('U-ADM-07: returns valid Set-Cookie string', () => {
    const header = adminCookieHeader('my-admin-token');
    expect(header).toContain('ws_admin=my-admin-token');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
    expect(header).toContain(`Max-Age=${ADMIN_MAX_AGE_S}`);
  });

  it('includes Secure in production', () => {
    process.env.NODE_ENV = 'production';
    const header = adminCookieHeader('tok');
    expect(header).toContain('Secure');
    process.env.NODE_ENV = 'test';
  });
});

describe('clearAdminCookieHeader', () => {
  it('U-ADM-08: returns cookie with Max-Age=0', () => {
    const header = clearAdminCookieHeader();
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('ws_admin=');
    expect(header).toContain('HttpOnly');
  });
});

describe('getAdminTokenFromRequest', () => {
  it('U-ADM-09: extracts token from cookie', () => {
    const req = new Request('https://example.com/admin', {
      headers: { cookie: 'ws_admin=my-token-value' },
    });
    expect(getAdminTokenFromRequest(req)).toBe('my-token-value');
  });

  it('U-ADM-10: returns null when no cookie', () => {
    const req = new Request('https://example.com/admin');
    expect(getAdminTokenFromRequest(req)).toBeNull();
  });

  it('extracts from multiple cookies', () => {
    const req = new Request('https://example.com/admin', {
      headers: { cookie: 'other=x; ws_admin=the-token; foo=bar' },
    });
    expect(getAdminTokenFromRequest(req)).toBe('the-token');
  });
});

describe('verifyAdminFromRequest', () => {
  it('U-ADM-11: returns true for valid admin cookie', () => {
    const token = signAdminToken();
    const req = new Request('https://example.com/admin', {
      headers: { cookie: `ws_admin=${token}` },
    });
    expect(verifyAdminFromRequest(req)).toBe(true);
  });

  it('U-ADM-12: returns false for invalid admin cookie', () => {
    const req = new Request('https://example.com/admin', {
      headers: { cookie: 'ws_admin=invalid-token' },
    });
    expect(verifyAdminFromRequest(req)).toBe(false);
  });

  it('returns false when no cookie present', () => {
    const req = new Request('https://example.com/admin');
    expect(verifyAdminFromRequest(req)).toBe(false);
  });
});

describe('adminAuditLog', () => {
  it('U-ADM-13: logs with correct format', () => {
    const consoleSpy = vi.spyOn(console, 'info');
    adminAuditLog('TEST_ACTION', { detail: 'test value' });
    expect(consoleSpy).toHaveBeenCalled();
    const loggedArgs = consoleSpy.mock.calls;
    const lastCall = loggedArgs[loggedArgs.length - 1][0];
    expect(lastCall).toContain('ADMIN_AUDIT');
    expect(lastCall).toContain('TEST_ACTION');
  });

  it('logs IP from request headers', () => {
    const consoleSpy = vi.spyOn(console, 'info');
    const req = new Request('https://example.com/admin', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    adminAuditLog('BAN_USER', { userId: '123' }, req);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
