import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';

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
      supabase
        .from('conversations')
        .update({ a_last_read_at: now })
        .eq('id', conversationId)
        .eq('event_id', session.eid)
        .eq('a_participant_id', session.sub)
        .select('id'),
      supabase
        .from('conversations')
        .update({ b_last_read_at: now })
        .eq('id', conversationId)
        .eq('event_id', session.eid)
        .eq('b_participant_id', session.sub)
        .select('id'),
    ]);

    if ((aRes.data?.length ?? 0) === 0 && (bRes.data?.length ?? 0) === 0) {
      return jsonError('Not a participant in this conversation', 403);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[conversations/read] error:', err);
    return jsonError('Server error', 500);
  }
}
