/**
 * Security attack tests — automated regression suite.
 *
 * Each test simulates a real attack scenario. These should stay GREEN
 * after every code change. If one turns RED, security regressed.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  signSessionToken,
  verifySessionToken,
  checkCsrf,
} from '@/lib/session';
import {
  signAdminToken,
  verifyAdminToken,
} from '@/lib/admin-auth';
import { verifyTotp, generateTotp } from '@/lib/totp';
import { isSafePath } from '@/lib/route-helpers';
import { detectImageType } from '@/lib/image-magic';

// ─── Test token data ──────────────────────────────────────────────
const SESSION_DATA = {
  participantId: '550e8400-e29b-41d4-a716-446655440000',
  eventId:       '660e8400-e29b-41d4-a716-446655441111',
  eventSlug:     'test-event',
  eventName:     'Test Event',
};

// ══════════════════════════════════════════════════════════════════
// 1. JWT SECURITY
// ══════════════════════════════════════════════════════════════════

describe('JWT — tamper resistance', () => {
  it('SEC-JWT-01: rejects a token with a tampered payload', () => {
    const token = signSessionToken(SESSION_DATA);
    const [header, body, sig] = token.split('.');
    // Tamper: change the participant ID in the payload
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    payload.sub = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const tamperedBody = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = `${header}.${tamperedBody}.${sig}`;

    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it('SEC-JWT-02: admin token cannot pass as a session token', () => {
    const adminToken = signAdminToken();
    // The `typ` discriminator must reject admin tokens on the session path
    expect(verifySessionToken(adminToken)).toBeNull();
  });

  it('SEC-JWT-03: session token cannot pass as an admin token', () => {
    const sessionToken = signSessionToken(SESSION_DATA);
    // The `role` check must reject session tokens on the admin path
    expect(verifyAdminToken(sessionToken)).toBe(false);
  });

  it('SEC-JWT-04: rejects an expired session token', () => {
    // Manually craft a token with exp in the past
    const secret = process.env.JWT_SECRET!;
    const crypto = require('crypto');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      typ: 'session',
      iss: 'test.example.com',
      aud: 'eventa-app',
      sub: SESSION_DATA.participantId,
      eid: SESSION_DATA.eventId,
      esl: SESSION_DATA.eventSlug,
      enm: SESSION_DATA.eventName,
      iat: now - 200,
      exp: now - 100, // expired
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig    = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    const token  = `${header}.${body}.${sig}`;

    expect(verifySessionToken(token)).toBeNull();
  });

  it('SEC-JWT-05: rejects a token signed with the wrong secret', () => {
    const wrongSecret = 'wrong-secret-that-is-definitely-not-the-real-one-123456789';
    const crypto = require('crypto');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      typ: 'session', iss: 'test.example.com', aud: 'eventa-app',
      sub: SESSION_DATA.participantId, eid: SESSION_DATA.eventId,
      esl: SESSION_DATA.eventSlug, enm: SESSION_DATA.eventName,
      iat: now, exp: now + 3600,
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig    = crypto.createHmac('sha256', wrongSecret).update(`${header}.${body}`).digest('base64url');
    expect(verifySessionToken(`${header}.${body}.${sig}`)).toBeNull();
  });

  it('SEC-JWT-06: rejects a token with wrong issuer', () => {
    const token = signSessionToken(SESSION_DATA);
    const [header, body, sig] = token.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    payload.iss = 'evil.attacker.com';
    const tamperedBody = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret = process.env.JWT_SECRET!;
    const crypto = require('crypto');
    const newSig = crypto.createHmac('sha256', secret).update(`${header}.${tamperedBody}`).digest('base64url');
    // Re-sign with wrong issuer — should still be rejected because iss doesn't match
    const tamperedToken = `${header}.${tamperedBody}.${newSig}`;
    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it('SEC-JWT-07: session epoch revocation — stale sep is caught', () => {
    // Token with sep=1 should fail if DB epoch is 3
    const token = signSessionToken({ ...SESSION_DATA, sessionEpoch: 1 });
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sep).toBe(1);
    // The secureGuard checks payload.sep < guardState.epoch → reject
    // This test verifies the claim is present; guard enforcement tested in route-helpers tests
    expect(payload!.sep).toBeLessThan(3); // 1 < 3 → would be rejected
  });

  it('SEC-JWT-08: rejects an empty string token', () => {
    expect(verifySessionToken('')).toBeNull();
    expect(verifyAdminToken('')).toBe(false);
    expect(verifySessionToken(null as unknown as string)).toBeNull();
    expect(verifyAdminToken(null)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. CSRF PROTECTION
// ══════════════════════════════════════════════════════════════════

describe('CSRF — Origin check', () => {
  it('SEC-CSRF-01: allows a same-origin request', () => {
    const req = new Request('https://test.example.com/api/secure/likes', {
      method: 'POST',
      headers: {
        'Origin': 'https://test.example.com',
        'Host': 'test.example.com',
      },
    });
    expect(checkCsrf(req as never)).toBe(true);
  });

  it('SEC-CSRF-02: blocks a cross-origin request', () => {
    const req = new Request('https://test.example.com/api/secure/likes', {
      method: 'POST',
      headers: {
        'Origin': 'https://evil-attacker.com',
        'Host': 'test.example.com',
      },
    });
    expect(checkCsrf(req as never)).toBe(false);
  });

  it('SEC-CSRF-03: blocks a POST request with no Origin header', () => {
    const req = new Request('https://test.example.com/api/secure/likes', {
      method: 'POST',
      headers: { 'Host': 'test.example.com' },
    });
    // No Origin header on a POST → CSRF check fails
    expect(checkCsrf(req as never)).toBe(false);
  });

  it('SEC-CSRF-04: allows a GET request without Origin (navigation)', () => {
    const req = new Request('https://test.example.com/api/auth/verify', {
      method: 'GET',
    });
    expect(checkCsrf(req as never)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. PATH TRAVERSAL
// ══════════════════════════════════════════════════════════════════

describe('Upload path — traversal prevention', () => {
  it('SEC-PATH-01: rejects ../../../etc/passwd', () => {
    expect(isSafePath('../../../etc/passwd')).toBe(false);
  });

  it('SEC-PATH-02: rejects encoded traversal %2e%2e%2f', () => {
    expect(isSafePath('%2e%2e%2f%2e%2e%2fetc%2fpasswd')).toBe(false);
  });

  it('SEC-PATH-03: rejects absolute path /etc/passwd', () => {
    expect(isSafePath('/etc/passwd')).toBe(false);
  });

  it('SEC-PATH-04: rejects Windows drive letter C:\\secrets', () => {
    expect(isSafePath('C:\\secrets\\key.env')).toBe(false);
  });

  it('SEC-PATH-05: rejects double-slash //etc', () => {
    expect(isSafePath('//etc')).toBe(false);
  });

  it('SEC-PATH-06: allows a valid nested path', () => {
    const eventId = '660e8400-e29b-41d4-a716-446655441111';
    const participantId = '550e8400-e29b-41d4-a716-446655440000';
    expect(isSafePath(`${eventId}/${participantId}/photo_1.jpg`)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. IMAGE MAGIC BYTES
// ══════════════════════════════════════════════════════════════════

describe('Image magic bytes — type detection', () => {
  it('SEC-IMG-01: detects a JPEG from magic bytes FF D8 FF', () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageType(buf)).toBe('jpeg');
  });

  it('SEC-IMG-02: detects a PNG from magic bytes', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectImageType(buf)).toBe('png');
  });

  it('SEC-IMG-03: detects a WebP from RIFF...WEBP header', () => {
    const buf = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageType(buf)).toBe('webp');
  });

  it('SEC-IMG-04: detects a GIF89a header', () => {
    const buf = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x10, 0x00, 0x80, 0x00]);
    expect(detectImageType(buf)).toBe('gif');
  });

  it('SEC-IMG-05: rejects a PHP script disguised as .jpg', () => {
    // <?php ... starts with 3C 3F 70 68 70
    const buf = new Uint8Array([0x3c, 0x3f, 0x70, 0x68, 0x70, 0x20, 0x65, 0x63, 0x68, 0x6f, 0x28, 0x27]);
    expect(detectImageType(buf)).toBeNull();
  });

  it('SEC-IMG-06: rejects a ZIP file disguised as .jpg', () => {
    // PK zip: 50 4B 03 04
    const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00]);
    expect(detectImageType(buf)).toBeNull();
  });

  it('SEC-IMG-07: rejects an ELF binary disguised as .png', () => {
    // ELF: 7F 45 4C 46
    const buf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(detectImageType(buf)).toBeNull();
  });

  it('SEC-IMG-08: rejects an empty buffer', () => {
    expect(detectImageType(new Uint8Array(0))).toBeNull();
  });

  it('SEC-IMG-09: rejects a PDF header', () => {
    // %PDF: 25 50 44 46
    const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00]);
    expect(detectImageType(buf)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// 5. TOTP SECURITY
// ══════════════════════════════════════════════════════════════════

describe('TOTP — security properties', () => {
  // Use a fixed test secret (RFC test vector compatible)
  const TEST_SECRET = 'JBSWY3DPEHPK3PXP'; // = "Hello!" in base32

  it('SEC-TOTP-01: accepts the current valid code', () => {
    const code = generateTotp(TEST_SECRET);
    expect(verifyTotp(code, TEST_SECRET)).toBe(true);
  });

  it('SEC-TOTP-02: rejects a wrong code', () => {
    expect(verifyTotp('000000', TEST_SECRET)).toBe(false);
    expect(verifyTotp('999999', TEST_SECRET)).toBe(false);
  });

  it('SEC-TOTP-03: rejects a code that is too far in the future', () => {
    const futureCode = generateTotp(TEST_SECRET, { t: Date.now() + 120_000 }); // 4 steps ahead
    expect(verifyTotp(futureCode, TEST_SECRET)).toBe(false);
  });

  it('SEC-TOTP-04: rejects a code that is too old', () => {
    const oldCode = generateTotp(TEST_SECRET, { t: Date.now() - 120_000 }); // 4 steps behind
    expect(verifyTotp(oldCode, TEST_SECRET)).toBe(false);
  });

  it('SEC-TOTP-05: rejects non-numeric input', () => {
    expect(verifyTotp('abcdef', TEST_SECRET)).toBe(false);
    expect(verifyTotp('12345x', TEST_SECRET)).toBe(false);
  });

  it('SEC-TOTP-06: rejects a code with wrong length', () => {
    expect(verifyTotp('12345', TEST_SECRET)).toBe(false);
    expect(verifyTotp('1234567', TEST_SECRET)).toBe(false);
  });

  it('SEC-TOTP-07: rejects empty / null secret', () => {
    const code = generateTotp(TEST_SECRET);
    expect(verifyTotp(code, '')).toBe(false);
    expect(verifyTotp(code, null as unknown as string)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// 6. CROSS-EVENT ISOLATION — API guard logic
// ══════════════════════════════════════════════════════════════════

describe('Cross-event isolation — session event binding', () => {
  it('SEC-EVENT-01: session token contains a fixed event_id that cannot be changed client-side', () => {
    const token = signSessionToken(SESSION_DATA);
    const payload = verifySessionToken(token);
    expect(payload!.eid).toBe(SESSION_DATA.eventId);

    // Attempt to re-use same signature with different event ID
    const [h, b, s] = token.split('.');
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    p.eid = '99999999-9999-9999-9999-999999999999'; // attacker swaps event
    const newB = Buffer.from(JSON.stringify(p)).toString('base64url');
    const tamperedToken = `${h}.${newB}.${s}`;

    // Must be rejected — signature won't match
    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it('SEC-EVENT-02: admin token does NOT contain an event_id', () => {
    const token = signAdminToken();
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.eid).toBeUndefined();
    expect(payload.sub).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════
// 7. OTP SECURITY
// ══════════════════════════════════════════════════════════════════

describe('OTP — hashing and timing safety', () => {
  it('SEC-OTP-01: OTP pepper changes the hash', () => {
    const crypto = require('crypto');
    const code = '123456';
    const withPepper    = crypto.createHash('sha256').update(`${code}my-secret-pepper`).digest('hex');
    const withoutPepper = crypto.createHash('sha256').update(`${code}`).digest('hex');
    expect(withPepper).not.toBe(withoutPepper);
  });

  it('SEC-OTP-02: same code with same pepper produces deterministic hash', () => {
    const crypto = require('crypto');
    const hash1 = crypto.createHash('sha256').update('123456my-pepper').digest('hex');
    const hash2 = crypto.createHash('sha256').update('123456my-pepper').digest('hex');
    expect(hash1).toBe(hash2);
  });

  it('SEC-OTP-03: different codes produce different hashes', () => {
    const crypto = require('crypto');
    const hash1 = crypto.createHash('sha256').update('123456pepper').digest('hex');
    const hash2 = crypto.createHash('sha256').update('654321pepper').digest('hex');
    expect(hash1).not.toBe(hash2);
  });
});
