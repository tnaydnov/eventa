/**
 * Integration tests for GET /api/cron/upload-reminders
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// ─── Mock dependencies ──────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetMs: 60000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: {
    strict: { maxRequests: 5, windowMs: 60000 },
  },
}));

vi.mock('@/lib/route-helpers', () => ({
  jsonError: vi.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/config', () => ({
  APP_BASE_URL: 'https://eventa.test',
  MSG_TIMING: {
    UPLOAD_REMINDER_DAYS: [7, 3],
    PRE_EVENT_HOURS: 3,
    FEEDBACK_HOURS: 3,
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'mid-1' }),
    }),
  },
}));

vi.mock('@/lib/email-templates', () => ({
  buildUploadReminderEmail: vi.fn().mockReturnValue({
    subject: 'Reminder',
    html: '<p>Upload your guest list</p>',
  }),
  buildUploadUrgentReminderEmail: vi.fn().mockReturnValue({
    subject: 'Urgent Reminder',
    html: '<p>Time is running out</p>',
  }),
}));

// Import handler — the file exports GET and POST both pointing to the same handler
import { GET } from '@/app/api/cron/upload-reminders/route';

const CRON_SECRET = 'test-cron-secret-123';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
});

function makeReq(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  return new NextRequest('http://localhost/api/cron/upload-reminders', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cron/upload-reminders', () => {
  it('returns 401 without auth header', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await GET(makeReq('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with "no events" when no events need reminders', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(0);
  });

  it('returns 500 on event query failure', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB fail' } }),
    });

    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(500);
  });
});
