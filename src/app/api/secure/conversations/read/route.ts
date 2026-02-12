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

    // Verify conversation exists AND belongs to this event
    const { data: conv, error: fetchErr } = await supabase
      .from('conversations')
      .select('a_participant_id, b_participant_id')
      .eq('id', conversationId)
      .eq('event_id', session.eid)
      .single();

    if (fetchErr || !conv) {
      return jsonError('Conversation not found', 404);
    }

    const isA = conv.a_participant_id === session.sub;
    const isB = conv.b_participant_id === session.sub;

    if (!isA && !isB) {
      return jsonError('Not a participant in this conversation', 403);
    }

    const updateField = isA ? 'a_last_read_at' : 'b_last_read_at';

    const { error } = await supabase
      .from('conversations')
      .update({ [updateField]: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      console.error('[conversations/read] error:', error);
      return jsonError('Failed to update read status', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[conversations/read] error:', err);
    return jsonError('Server error', 500);
  }
}
