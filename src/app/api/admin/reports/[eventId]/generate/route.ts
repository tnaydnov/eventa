import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { adminGuard, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { generateReport } from '@/lib/report/generate';

/**
 * POST /api/admin/reports/[eventId]/generate
 * Triggers on-demand report generation (admin only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-reports-generate', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  if (!eventId) return jsonError('Missing eventId', 400);

  logger.info(`[ADMIN_REPORTS_GENERATE] Generating report for event ${eventId}`);

  const result = await generateReport(eventId);

  if (!result.success) {
    logger.error('[ADMIN_REPORTS_GENERATE] failed:', result.error);
    return jsonError(result.error ?? 'Failed to generate report', 500);
  }

  return NextResponse.json({ success: true, event_id: eventId });
}
