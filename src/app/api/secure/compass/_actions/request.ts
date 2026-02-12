/**
 * Compass action: request
 * Create a compass request (requires mutual interaction).
 */
import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID, type SessionPayload } from '@/lib/session';
import { COMPASS_TIMEOUT_MS } from '@/lib/constants';
import { jsonError } from '@/lib/route-helpers';
import { hasMutualInteraction } from '../_helpers';

export async function handleRequest(
  session: SessionPayload,
  body: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<NextResponse> {
  const { otherId } = body as { otherId?: string };
  if (!otherId || !isValidUUID(otherId)) {
    return jsonError('Invalid participant', 400);
  }

  // Guard: no self-request
  if (otherId === session.sub) {
    return jsonError('Cannot request compass with yourself', 400);
  }

  // Guard: mutual interaction required
  const eligible = await hasMutualInteraction(supabase, session.eid, session.sub, otherId);
  if (!eligible) {
    return NextResponse.json(
      { error: 'MUTUAL_REQUIRED', message: 'מצפן זמין רק אחרי שניכם עשיתם לייק או שניכם כתבתם בצ׳אט' },
      { status: 403 }
    );
  }

  // Guard: one pending request at a time
  const timeoutCutoff = new Date(Date.now() - COMPASS_TIMEOUT_MS).toISOString();

  // Auto-close any expired pending sessions from this user first
  await supabase
    .from('compass_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('event_id', session.eid)
    .eq('requested_by', session.sub)
    .eq('status', 'pending')
    .lt('created_at', timeoutCutoff);

  // Check for still-active pending requests
  const { data: existingPending } = await supabase
    .from('compass_sessions')
    .select('id')
    .eq('event_id', session.eid)
    .eq('requested_by', session.sub)
    .eq('status', 'pending')
    .gte('created_at', timeoutCutoff)
    .limit(1);

  if (existingPending && existingPending.length > 0) {
    return NextResponse.json(
      { error: 'ALREADY_PENDING', message: 'יש לך כבר בקשת מצפן פעילה. המתן לתשובה או שהיא תפוג בעוד מספר דקות.' },
      { status: 409 }
    );
  }

  // Create the compass session
  const { data, error } = await supabase
    .from('compass_sessions')
    .insert({
      event_id: session.eid,
      participant_a_id: session.sub,
      participant_b_id: otherId,
      status: 'pending',
      requested_by: session.sub,
      activated_at: null,
      closed_at: null,
    })
    .select()
    .single();

  if (error) {
    console.error('[COMPASS_REQUEST] error:', error);
    return jsonError('Failed to create compass request', 400);
  }

  // Activity log (fire-and-forget)
  supabase.from('activity_log').insert({
    event_id: session.eid,
    participant_id: session.sub,
    action: 'compass_request',
  }).then();

  // Notification
  await supabase.from('notifications').insert({
    event_id: session.eid,
    to_participant_id: otherId,
    type: 'compass_request',
    payload: { from_participant_id: session.sub, session_id: data.id },
    is_read: false,
  });

  return NextResponse.json(data);
}
