/**
 * Compass action: location
 * Update compass location for a participant in an active session.
 */
import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID, type SessionPayload } from '@/lib/session';
import { jsonError } from '@/lib/route-helpers';
import { LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX } from '../_helpers';

export async function handleLocation(
  session: SessionPayload,
  body: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<NextResponse> {
  const { sessionId, lat, lng, accuracy, heading } = body as {
    sessionId?: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    heading?: number;
  };

  if (!sessionId || !isValidUUID(sessionId)) {
    return jsonError('Invalid session', 400);
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return jsonError('lat and lng are required numbers', 400);
  }

  // Validate coordinate ranges
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return jsonError('Coordinates out of range', 400);
  }

  // Verify participant is part of this session and session is active
  const { data: cs } = await supabase
    .from('compass_sessions')
    .select('participant_a_id, participant_b_id, status')
    .eq('id', sessionId)
    .single();

  if (!cs || (cs.participant_a_id !== session.sub && cs.participant_b_id !== session.sub)) {
    return jsonError('Forbidden', 403);
  }

  if (cs.status !== 'active') {
    return jsonError('Session not active', 400);
  }

  await supabase.from('compass_locations').upsert(
    {
      compass_session_id: sessionId,
      participant_id: session.sub,
      lat,
      lng,
      accuracy: typeof accuracy === 'number' ? accuracy : 0,
      heading: typeof heading === 'number' ? heading : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'compass_session_id,participant_id' }
  );

  return NextResponse.json({ success: true });
}
