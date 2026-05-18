import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { generateReport } from '@/lib/report/generate';
import { sendReportEmail } from '@/lib/report/email';

/**
 * POST /api/admin/reports/[eventId]/send
 * Sends (or re-sends) a report email immediately.
 * Body: { email?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const denied = adminGuard(req, 'admin-reports-send', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  if (!eventId) return jsonError('Missing eventId', 400);

  let overrideEmail: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.email === 'string' && body.email.trim()) {
      overrideEmail = body.email.trim();
    }
  } catch {
    // ignore parse errors - email override is optional
  }

  const supabase = getServiceClient();

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, name, client_email, send_report_email')
    .eq('id', eventId)
    .maybeSingle();

  if (eventErr) {
    logger.error('[ADMIN_REPORTS_SEND] event fetch error:', eventErr.message);
    return jsonError('Server error', 500);
  }
  if (!event) return jsonError('Event not found', 404);

  if (event.send_report_email === false && !overrideEmail) {
    return jsonError('Report email delivery is disabled for this event', 409);
  }

  const to = overrideEmail ?? event.client_email;
  if (!to) return jsonError('No recipient email configured', 400);

  const reportResult = await generateReport(eventId);
  if (!reportResult.success || !reportResult.payload) {
    return jsonError(reportResult.error ?? 'Failed to generate report', 500);
  }

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('client_portal_tokens')
    .select('token')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (tokenErr) {
    logger.error('[ADMIN_REPORTS_SEND] token fetch error:', tokenErr.message);
    return jsonError('Server error', 500);
  }
  if (!tokenRow?.token) return jsonError('No active portal token for event', 409);

  const sent = await sendReportEmail({
    to,
    eventName: event.name as string,
    eventId,
    portalToken: tokenRow.token as string,
    payload: reportResult.payload,
    aiSummary: reportResult.ai_summary,
  });

  if (!sent) return jsonError('Failed to send report email', 500);

  const sentAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('event_reports')
    .update({ email_sent_at: sentAt, email_sent_to: to })
    .eq('event_id', eventId);

  if (updateErr) {
    logger.error('[ADMIN_REPORTS_SEND] update event_reports error:', updateErr.message);
  }

  return NextResponse.json({ success: true, event_id: eventId, email: to, sent_at: sentAt });
}
