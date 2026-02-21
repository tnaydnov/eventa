import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, serviceUpdate } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/secure/conversations/read
 * Body: { conversationId: string }
 * Marks a conversation as read by updating the participant's last_read_at.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'conv-read', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId || !isValidUUID(conversationId)) {
      return jsonError('Invalid conversationId', 400);
    }

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // Try both updates in parallel — only one will match
    const [aRes, bRes] = await Promise.all([
      serviceUpdate(
        'conversations',
        { a_last_read_at: now },
        { id: conversationId, event_id: session.eid, a_participant_id: session.sub }
      ),
      serviceUpdate(
        'conversations',
        { b_last_read_at: now },
        { id: conversationId, event_id: session.eid, b_participant_id: session.sub }
      ),
    ]);

    // Check for DB errors first — don't mask them as 403
    if (aRes.error || bRes.error) {
      if (aRes.error) logger.error('[conversations/read] a update error:', aRes.error.message);
      if (bRes.error) logger.error('[conversations/read] b update error:', bRes.error.message);
      return jsonError('Server error', 500);
    }

    const aCount = Array.isArray(aRes.data) ? aRes.data.length : 0;
    const bCount = Array.isArray(bRes.data) ? bRes.data.length : 0;
    if (aCount === 0 && bCount === 0) {
      return jsonError('Not a participant in this conversation', 403);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[conversations/read] error:', err);
    return jsonError('Server error', 500);
  }
}
