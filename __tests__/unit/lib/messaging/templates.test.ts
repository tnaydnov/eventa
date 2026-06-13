/**
 * Unit tests for lib/messaging/templates.ts
 * Tests: URL builders, SMS text, WA template variable factories
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  APP_BASE_URL: 'https://eventa.test',
  OTP_EXPIRY_S: 300,
}));

import {
  buildJoinUrl,
  buildFeedbackUrl,
  otpSmsText,
  preEventSmsText,
  welcomeSmsText,
  feedbackSmsText,
} from '@/lib/messaging/templates';
import type { EventMessagingConfig } from '@/lib/messaging/types';

// ─── Fixtures ───────────────────────────────────────────

const mockConfig: EventMessagingConfig = {
  eventId: 'evt-001',
  eventName: 'מסיבת קיץ',
  eventSlug: 'summer-party',
  messagesEnabled: true,
};

// ─── buildJoinUrl ───────────────────────────────────────

describe('buildJoinUrl', () => {
  it('builds the join URL from the slug (no join code)', () => {
    expect(buildJoinUrl('summer-party')).toBe('https://eventa.test/summer-party');
  });

  it('handles slugs with special characters', () => {
    expect(buildJoinUrl('my-event-2025')).toBe('https://eventa.test/my-event-2025');
  });
});

// ─── buildFeedbackUrl ───────────────────────────────────

describe('buildFeedbackUrl', () => {
  it('builds correct feedback URL', () => {
    expect(buildFeedbackUrl('summer-party')).toBe(
      'https://eventa.test/summer-party/feedback'
    );
  });

  it('handles slug with special chars', () => {
    expect(buildFeedbackUrl('noa-and-tomer-wedding')).toBe(
      'https://eventa.test/noa-and-tomer-wedding/feedback'
    );
  });
});

// ─── otpSmsText ─────────────────────────────────────────

describe('otpSmsText', () => {
  it('returns Hebrew SMS text with embedded code', () => {
    const text = otpSmsText('123456');
    expect(text).toContain('123456');
    expect(text).toContain('Eventa');
    expect(text).toContain('5 דקות');
  });

  it('includes the exact code passed in', () => {
    const text = otpSmsText('999888');
    expect(text).toContain('999888');
  });
});

// ─── preEventSmsText ────────────────────────────────────

describe('preEventSmsText', () => {
  it('includes the event name and the join URL', () => {
    const text = preEventSmsText(mockConfig);
    expect(text).toContain('מסיבת קיץ');
    expect(text).toContain('https://eventa.test/summer-party');
  });
});

// ─── welcomeSmsText ─────────────────────────────────────

describe('welcomeSmsText', () => {
  it('includes the event name and the join URL', () => {
    const text = welcomeSmsText(mockConfig);
    expect(text).toContain('מסיבת קיץ');
    expect(text).toContain('https://eventa.test/summer-party');
  });
});

// ─── feedbackSmsText ────────────────────────────────────

describe('feedbackSmsText', () => {
  it('includes the event name and the feedback URL', () => {
    const text = feedbackSmsText(mockConfig);
    expect(text).toContain('מסיבת קיץ');
    expect(text).toContain('https://eventa.test/summer-party/feedback');
  });
});
