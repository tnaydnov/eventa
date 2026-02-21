import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient, generateJoinCode } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/events/[eventId]/rotate
 * Generates a new join code for the event, invalidating the old one.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-rotate', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('events')
      .update({ join_code: generateJoinCode() })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      logger.error('[ADMIN_ROTATE] DB error:', error.message);
      return jsonError('Failed to rotate code', 500);
    }

    adminAuditLog('JOIN_CODE_ROTATE', { eventId }, req);
    return NextResponse.json({ event: data });
  } catch (err) {
    logger.error('[ADMIN_ROTATE] error:', err);
    return jsonError('Failed to rotate code', 500);
  }
}
