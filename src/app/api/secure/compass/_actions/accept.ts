/**
 * Compass action: accept
 * Accept a pending compass request.
 */
import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID, type SessionPayload } from '@/lib/session';
import { COMPASS_TIMEOUT_MS } from '@/lib/constants';
import { jsonError } from '@/lib/route-helpers';

export async function handleAccept(
  session: SessionPayload,
  body: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<NextResponse> {
  const { sessionId } = body as { sessionId?: string };
  if (!sessionId || !isValidUUID(sessionId)) {
    return jsonError('Invalid session', 400);
  }

  // Verify participant is part of this session
  const { data: cs } = await supabase
    .from('compass_sessions')
    .select('participant_a_id, participant_b_id, status, requested_by, created_at')
    .eq('id', sessionId)
    .single();

  if (!cs || (cs.participant_a_id !== session.sub && cs.participant_b_id !== session.sub)) {
    return jsonError('Forbidden', 403);
  }

  // Guard: requester cannot accept their own request
  if (cs.requested_by === session.sub) {
    return jsonError('Cannot accept your own request', 400);
  }

  if (cs.status !== 'pending') {
    return jsonError('Session is no longer pending', 400);
  }

  // Check timeout
  const age = Date.now() - new Date(cs.created_at).getTime();
  if (age > COMPASS_TIMEOUT_MS) {
    await supabase
      .from('compass_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', sessionId);
    return NextResponse.json(
      { error: 'EXPIRED', message: 'בקשת המצפן פגה. בקשו אחת חדשה.' },
      { status: 410 }
    );
  }

  const { error } = await supabase
    .from('compass_sessions')
    .update({ status: 'active', activated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('[COMPASS_ACCEPT] error:', error);
    return jsonError('Failed to accept compass request', 400);
  }

  // Activity log (fire-and-forget)
  supabase.from('activity_log').insert({
    event_id: session.eid,
    participant_id: session.sub,
    action: 'compass_activate',
  }).then();

  // Auto-close all OTHER pending requests from the requester
  await supabase
    .from('compass_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('event_id', session.eid)
    .eq('requested_by', cs.requested_by)
    .eq('status', 'pending')
    .neq('id', sessionId);

  // Notify the requester
  const notifyId =
    cs.participant_a_id === session.sub ? cs.participant_b_id : cs.participant_a_id;

  await supabase.from('notifications').insert({
    event_id: session.eid,
    to_participant_id: notifyId,
    type: 'compass_accepted',
    payload: { from_participant_id: session.sub, session_id: sessionId },
    is_read: false,
  });

  return NextResponse.json({ success: true });
}
