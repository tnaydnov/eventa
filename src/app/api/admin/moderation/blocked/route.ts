import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { adminGuard } from '../../_helpers';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/moderation/blocked
 * Returns blocked moderation_log rows from the last 7 days for false-positive recovery.
 */
async function handler(req: NextRequest) {
  const denied = await adminGuard(req, 'admin-moderation-blocked', RATE_LIMITS.standard);
  if (denied) return denied;

  const supabase = getServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString();

  const { data, error } = await supabase
    .from('moderation_log')
    .select('id, event_id, surface, storage_path, reason, scores, second_opinion, model, participant_id, admin_action, created_at')
    .eq('decision', 'blocked')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    logger.error('[ADMIN_MODERATION_BLOCKED] fetch error:', error.message);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export const GET = handler;
