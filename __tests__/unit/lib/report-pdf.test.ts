/**
 * Unit test for lib/report/pdf.ts - verifies the styled Hebrew PDF generates server-side
 * (jsPDF + embedded Noto Sans Hebrew) and produces a valid, non-trivial single PDF.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { generateReportPdf, toReportPdfFilename } from '@/lib/report/pdf';
import type { CuratedReportPayload } from '@/lib/report/curate';

function mockPayload(): CuratedReportPayload {
  return {
    schema_version: 1,
    generated_at: '2026-06-12T13:00:00.000Z',
    event_id: 'evt-1',
    engagement: {
      total_likes: 4,
      mutual_likes: 1,
      total_conversations: 2,
      total_messages: 8,
      avg_messages_per_conversation: 4,
      conversations_with_3plus_messages: 1,
      one_message_conversations: 1,
      dead_matches: 0,
      match_rate: 50,
      first_message_by_men: 1,
      first_message_by_women: 1,
      ghosted_conversations: 0,
      first_like_by_men: 2,
      first_like_by_women: 1,
    },
    funnel: {
      steps: [
        { step: 'join_page_view', count: 50 },
        { step: 'otp_requested', count: 24 },
        { step: 'otp_verified', count: 20 },
        { step: 'setup_started', count: 27 },
        { step: 'profile_complete', count: 17 },
      ],
      top_drop_off: 'otp_requested',
    },
    time_dynamics: { hourly_activity: [], peak_hour: null },
    network: {
      total_participants: 13,
      participants_with_matches: 2,
      participants_with_messages: 4,
      isolated_participants: 5,
      avg_likes_sent: 0.3,
      avg_likes_received: 0.3,
    },
    crosstabs: {
      gender_distribution: [
        { label: 'male', count: 7 },
        { label: 'female', count: 6 },
      ],
      age_buckets: [],
      attraction_distribution: [],
    },
    safety: { total_blocks: 1, banned_participants: 0, deleted_participants: 2 },
  };
}

describe('report pdf generator', () => {
  it('produces a valid PDF buffer with the embedded Hebrew font (non-trivial size)', () => {
    const pdf = generateReportPdf({
      eventName: 'Shirel & Peleg',
      eventId: 'evt-1',
      payload: mockPayload(),
      aiSummary: 'האירוע היה מוצלח עם מעורבות גבוהה של המשתתפים לאורך כל הערב.',
      eventDate: '2026-06-10T18:00:00.000Z',
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Embedding a real TTF subset makes the styled PDF much larger than the ASCII fallback.
    expect(pdf.length).toBeGreaterThan(8000);
  });

  it('handles a Hebrew event name + missing AI summary without throwing', () => {
    const pdf = generateReportPdf({
      eventName: 'חתונה של דנה ויוסי',
      eventId: 'evt-2',
      payload: mockPayload(),
      aiSummary: null,
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('sanitizes report filename', () => {
    expect(toReportPdfFilename('Shirel & Peleg')).toBe('eventa-report-shirel-peleg.pdf');
    expect(toReportPdfFilename('Amazing חתונה 2026 !!!')).toBe('eventa-report-amazing-2026.pdf');
  });
});
