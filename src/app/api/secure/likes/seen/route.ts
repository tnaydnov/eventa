import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';

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
    const body = await req.json();
    const { fromParticipantId, all } = body;

    if (!fromParticipantId && !all) {
      return jsonError('fromParticipantId or all=true required', 400);
    }

    // Validate UUID when provided
    if (fromParticipantId && !isValidUUID(fromParticipantId)) {
      return jsonError('Invalid fromParticipantId', 400);
    }

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
      console.error('[likes/seen] error:', error);
      return jsonError('Failed to mark likes as seen', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[likes/seen] error:', err);
    return jsonError('Server error', 500);
  }
}
