import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { likeSeenSchema } from '@/lib/validations';

/**
 * POST /api/secure/likes/seen
 * Body: { fromParticipantId?: string, all?: boolean }
 * Marks a specific like (or all incoming likes) as seen.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'likes-seen', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const raw = await req.json();
    const parsed = likeSeenSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError('Invalid request', 400);
    }
    const { fromParticipantId, all } = parsed.data;

    const supabase = getServiceClient();

    let query = supabase
      .from('likes')
      .update({ seen_at: new Date().toISOString() })
      .eq('event_id', session.eid)
      .eq('to_participant_id', session.sub)
      .is('seen_at', null);

    if (fromParticipantId) {
      query = query.eq('from_participant_id', fromParticipantId);
    }

    const { error } = await query;

    if (error) {
      logger.error('[likes/seen] error:', error);
      return jsonError('Failed to mark likes as seen', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[likes/seen] error:', err);
    return jsonError('Server error', 500);
  }
}
