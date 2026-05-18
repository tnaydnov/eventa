/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { generateReportPdf, toReportPdfFilename } from '@/lib/report/pdf';

describe('report pdf generator', () => {
  it('generates a valid PDF buffer', () => {
    const payload = {
      schema_version: 1,
      generated_at: '2026-05-17T12:00:00.000Z',
      event_id: '11111111-1111-1111-1111-111111111111',
      engagement: {
        total_likes: 120,
        mutual_likes: 40,
        match_rate: 33.3,
        total_conversations: 16,
        total_messages: 210,
      },
      funnel: {
        steps: [
          { step: 'join_started', count: 100 },
          { step: 'profile_complete', count: 82 },
          { step: 'like_sent', count: 60 },
        ],
        top_drop_off: 'join_started -> profile_complete',
      },
      time_dynamics: { hourly_activity: [], peak_hour: 22 },
      network: { total_participants: 92 },
      crosstabs: { gender_distribution: [], age_buckets: [] },
      safety: {
        total_blocks: 3,
        total_reports: 2,
        banned_participants: 1,
      },
    } as unknown as Parameters<typeof generateReportPdf>[0]['payload'];

    const pdf = generateReportPdf({
      eventName: 'Summer Event',
      eventId: '11111111-1111-1111-1111-111111111111',
      payload,
      aiSummary: 'Great engagement and healthy conversion.',
      portalUrl: 'https://www.eventa.productions/portal/token/report',
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(200);
    expect(pdf.toString('latin1', 0, 8)).toContain('%PDF-1.4');
    expect(pdf.toString('latin1')).toContain('Eventa Post-Event Report');
    expect(pdf.toString('latin1')).toContain('Summer Event');
  });

  it('sanitizes report filename', () => {
    const filename = toReportPdfFilename('Amazing חתונה 2026 !!!');
    expect(filename).toBe('eventa-report-amazing-2026.pdf');
  });
});
