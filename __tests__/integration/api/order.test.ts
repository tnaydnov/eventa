/**
 * Integration tests for POST /api/order
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    strict: { maxRequests: 5, windowMs: 60000 },
    standard: { maxRequests: 30, windowMs: 60000 },
  },
}));

vi.mock('@/lib/session', () => ({
  checkCsrf: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/constants', () => ({
  EVENT_TYPE_LABELS: { wedding: 'חתונה', party: 'מסיבה' },
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
}));

vi.mock('@/lib/config', () => ({
  ORDER_NAME_MAX_LENGTH: 100,
  ORDER_PHONE_MAX_LENGTH: 30,
  ORDER_EMAIL_MAX_LENGTH: 254,
}));

const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: '123' }));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

import { POST } from '@/app/api/order/route';
import { checkCsrf } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validOrder = {
  eventType: 'wedding',
  eventDate: '2025-06-15',
  contactName: 'Test User',
  contactPhone: '050-1234567',
  contactEmail: 'test@example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkCsrf).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 });
  mockSendMail.mockResolvedValue({ messageId: '123' });
});

describe('POST /api/order', () => {
  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrf).mockReturnValue(false);
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid body (missing contactName)', async () => {
    const res = await POST(makeReq({ ...validOrder, contactName: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid phone format', async () => {
    const res = await POST(makeReq({ ...validOrder, contactPhone: 'not-a-phone!@#' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and sends email on valid input', async () => {
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledOnce();
  });

  it('accepts order without email', async () => {
    const { contactEmail, ...noEmail } = validOrder;
    const res = await POST(makeReq(noEmail));
    expect(res.status).toBe(200);
  });

  it('returns 500 when email sending fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'));
    const res = await POST(makeReq(validOrder));
    expect(res.status).toBe(500);
  });

  it('escapes HTML in email template', async () => {
    const xssOrder = {
      ...validOrder,
      contactName: '<script>alert("xss")</script>',
    };
    await POST(makeReq(xssOrder));
    const call = mockSendMail.mock.calls[0]?.[0];
    expect(call?.html).not.toContain('<script>');
    expect(call?.html).toContain('&lt;script&gt;');
  });
});
