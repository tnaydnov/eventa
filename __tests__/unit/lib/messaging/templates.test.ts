/**
 * Unit tests for lib/messaging/templates.ts
 * Tests: URL builders, SMS text, WA template variable factories
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  APP_BASE_URL: 'https://eventa.test',
}));

import {
  buildJoinUrl,
  buildFeedbackUrl,
  otpSmsText,
  WA_TEMPLATES,
  preEventVars,
  welcomeVars,
  feedbackVars,
} from '@/lib/messaging/templates';
import type { EventMessagingConfig } from '@/lib/messaging/types';

// ─── Fixtures ───────────────────────────────────────────

const mockConfig: EventMessagingConfig = {
  eventId: 'evt-001',
  eventName: 'מסיבת קיץ',
  eventSlug: 'summer-party',
  joinCode: 'ABC123',
  eventDate: '2025-08-15',
  organizerName: 'דניאל',
};

// ─── buildJoinUrl ───────────────────────────────────────

describe('buildJoinUrl', () => {
  it('builds correct join URL', () => {
    expect(buildJoinUrl('summer-party', 'ABC123')).toBe(
      'https://eventa.test/dating/summer-party/join?k=ABC123'
    );
  });

  it('handles slugs with special characters', () => {
    expect(buildJoinUrl('my-event-2025', 'XY99')).toBe(
      'https://eventa.test/dating/my-event-2025/join?k=XY99'
    );
  });

  it('handles empty join code', () => {
    expect(buildJoinUrl('event', '')).toBe(
      'https://eventa.test/dating/event/join?k='
    );
  });
});

// ─── buildFeedbackUrl ───────────────────────────────────

describe('buildFeedbackUrl', () => {
  it('builds correct feedback URL', () => {
    expect(buildFeedbackUrl('evt-001')).toBe(
      'https://eventa.test/feedback/evt-001'
    );
  });

  it('handles UUID-style event IDs', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(buildFeedbackUrl(uuid)).toBe(
      `https://eventa.test/feedback/${uuid}`
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

// ─── WA_TEMPLATES ───────────────────────────────────────

describe('WA_TEMPLATES', () => {
  it('has expected template names', () => {
    expect(WA_TEMPLATES.PRE_EVENT).toBe('eventa_pre_event');
    expect(WA_TEMPLATES.WELCOME).toBe('eventa_welcome');
    expect(WA_TEMPLATES.FEEDBACK).toBe('eventa_feedback_v2');
  });
});

// ─── preEventVars ───────────────────────────────────────

describe('preEventVars', () => {
  it('builds 3 params: guestName, eventName, joinUrl', () => {
    const vars = preEventVars(mockConfig, 'שרה');
    expect(vars).toHaveLength(3);
    expect(vars[0]).toEqual({ type: 'text', text: 'שרה' });
    expect(vars[1]).toEqual({ type: 'text', text: 'מסיבת קיץ' });
    expect(vars[2]).toEqual({
      type: 'text',
      text: 'https://eventa.test/dating/summer-party/join?k=ABC123',
    });
  });

  it('uses empty string when guestName is null', () => {
    const vars = preEventVars(mockConfig, null);
    expect(vars[0]).toEqual({ type: 'text', text: '' });
  });

  it('uses empty string when guestName is undefined', () => {
    const vars = preEventVars(mockConfig);
    expect(vars[0]).toEqual({ type: 'text', text: '' });
  });
});

// ─── welcomeVars ────────────────────────────────────────

describe('welcomeVars', () => {
  it('builds 2 params: eventName, joinUrl', () => {
    const vars = welcomeVars(mockConfig);
    expect(vars).toHaveLength(2);
    expect(vars[0]).toEqual({ type: 'text', text: 'מסיבת קיץ' });
    expect(vars[1]).toEqual({
      type: 'text',
      text: 'https://eventa.test/dating/summer-party/join?k=ABC123',
    });
  });
});

// ─── feedbackVars ───────────────────────────────────────

describe('feedbackVars', () => {
  it('builds 3 params: eventName, feedbackUrl, websiteUrl', () => {
    const vars = feedbackVars(mockConfig);
    expect(vars).toHaveLength(3);
    expect(vars[0]).toEqual({ type: 'text', text: 'מסיבת קיץ' });
    expect(vars[1]).toEqual({
      type: 'text',
      text: 'https://eventa.test/feedback/evt-001',
    });
    expect(vars[2]).toEqual({
      type: 'text',
      text: 'https://eventa.test',
    });
  });
});
