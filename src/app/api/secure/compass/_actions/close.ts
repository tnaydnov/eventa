/**
 * Compass action: close
 * Close, decline, or expire a compass session.
 */
import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID, type SessionPayload } from '@/lib/session';
import { jsonError } from '@/lib/route-helpers';
import { findOrCreateConversation } from '../_helpers';

export async function handleClose(
  session: SessionPayload,
  body: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<NextResponse> {
  const { sessionId, reason } = body as { sessionId?: string; reason?: string };
  if (!sessionId || !isValidUUID(sessionId)) {
    return jsonError('Invalid session', 400);
  }

  // Verify participant is part of this session
  const { data: cs } = await supabase
    .from('compass_sessions')
    .select('participant_a_id, participant_b_id, requested_by, event_id')
    .eq('id', sessionId)
    .single();

  if (!cs || (cs.participant_a_id !== session.sub && cs.participant_b_id !== session.sub)) {
    return jsonError('Forbidden', 403);
  }

  const { error } = await supabase
    .from('compass_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('[COMPASS_CLOSE] error:', error);
    return jsonError('Failed to close compass session', 400);
  }

  // Determine the other participant
  const otherId =
    cs.participant_a_id === session.sub ? cs.participant_b_id : cs.participant_a_id;

  // Handle close reason notifications
  if (reason === 'declined') {
    // Send system message in chat
    const convId = await findOrCreateConversation(supabase, cs.event_id, session.sub, otherId);
    if (convId) {
      await supabase.from('messages').insert({
        event_id: cs.event_id,
        conversation_id: convId,
        sender_participant_id: session.sub,
        type: 'system',
        text: '🧭 בקשת המצפן נדחתה',
      });
    }

    // Notify sender so their compass-wait clears
    await supabase.from('notifications').insert({
      event_id: cs.event_id,
      to_participant_id: cs.requested_by,
      type: 'compass_declined',
      payload: { session_id: sessionId, declined_by: session.sub },
      is_read: false,
    });
  } else if (reason === 'expired') {
    // Send "missed compass request" chat message to the recipient
    const recipientId =
      cs.participant_a_id === cs.requested_by ? cs.participant_b_id : cs.participant_a_id;

    const convId = await findOrCreateConversation(
      supabase,
      cs.event_id,
      cs.requested_by,
      recipientId
    );
    if (convId) {
      await supabase.from('messages').insert({
        event_id: cs.event_id,
        conversation_id: convId,
        sender_participant_id: cs.requested_by,
        type: 'system',
        text: '🧭 שלחתי לך בקשת מצפן אבל פספסת... שלח/י לי הודעה ונתאם!',
      });
    }
  } else if (!reason) {
    // Cancelled by sender — notify the recipient
    const recipientId =
      cs.participant_a_id === cs.requested_by ? cs.participant_b_id : cs.participant_a_id;

    await supabase.from('notifications').insert({
      event_id: cs.event_id,
      to_participant_id: recipientId,
      type: 'compass_cancelled',
      payload: { session_id: sessionId, cancelled_by: session.sub },
      is_read: false,
    });
  }

  return NextResponse.json({ success: true });
}
