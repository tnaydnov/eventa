import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { adminGuard, jsonError } from '../../_helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/reports/[eventId]
 * Returns the curated report for an event (admin only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = await adminGuard(req, 'admin-reports-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  if (!eventId) return jsonError('Missing eventId', 400);

  const supabase = getServiceClient();

  const { data: report, error } = await supabase
    .from('event_reports')
    .select('curated_payload, ai_summary, generated_at, schema_version, email_sent_at, email_sent_to')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    logger.error('[ADMIN_REPORTS_GET] error:', error.message);
    return jsonError('Server error', 500);
  }

  if (!report) {
    return jsonError('Report not found', 404);
  }

  return NextResponse.json({ report });
}
