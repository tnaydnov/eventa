import { NextRequest, NextResponse } from 'next/server';
import type { CuratedReportPayload } from '@/lib/report/curate';
import { generateReportPdf, toReportPdfFilename } from '@/lib/report/pdf';
import { getServiceClient } from '@/lib/supabase';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/portal/[token]/report/pdf
 * Returns a generated PDF report for a valid client portal token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 4 || token.length > 128) {
    return jsonError('Invalid token', 400);
  }

  const supabase = getServiceClient();

  const { data: portalToken, error: tokenError } = await supabase
    .from('client_portal_tokens')
    .select('event_id')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (tokenError) {
    logger.error('[PORTAL_REPORT_PDF] token lookup error:', tokenError.message);
    return jsonError('Server error', 500);
  }

  if (!portalToken?.event_id) {
    return jsonError('Invalid or expired link', 404);
  }

  const eventId = portalToken.event_id as string;

  const [eventRes, reportRes] = await Promise.all([
    supabase
      .from('events')
      .select('name, ends_at')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('event_reports')
      .select('curated_payload, ai_summary')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (eventRes.error) {
    logger.error('[PORTAL_REPORT_PDF] event fetch error:', eventRes.error.message);
    return jsonError('Server error', 500);
  }
  if (!eventRes.data) {
    return jsonError('Event not found', 404);
  }

  if (reportRes.error) {
    logger.error('[PORTAL_REPORT_PDF] report fetch error:', reportRes.error.message);
    return jsonError('Server error', 500);
  }
  if (!reportRes.data?.curated_payload) {
    return jsonError('Report not found', 404);
  }

  const payload = reportRes.data.curated_payload as CuratedReportPayload;
  const aiSummary = typeof reportRes.data.ai_summary === 'string' ? reportRes.data.ai_summary : null;

  const pdf = generateReportPdf({
    eventName: eventRes.data.name as string,
    eventId,
    payload,
    aiSummary,
    eventDate: (eventRes.data.ends_at as string) ?? null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': `attachment; filename="${toReportPdfFilename(eventRes.data.name as string)}"`,
    },
  });
}
