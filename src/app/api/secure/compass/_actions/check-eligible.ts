/**
 * Compass action: check-eligible
 * Check if compass is available for a pair (requires mutual interaction).
 */
import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID, type SessionPayload } from '@/lib/session';
import { jsonError } from '@/lib/route-helpers';
import { hasMutualInteraction } from '../_helpers';

export async function handleCheckEligible(
  session: SessionPayload,
  body: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<NextResponse> {
  const { otherId } = body as { otherId?: string };
  if (!otherId || !isValidUUID(otherId)) {
    return jsonError('Invalid participant', 400);
  }

  const eligible = await hasMutualInteraction(supabase, session.eid, session.sub, otherId);
  return NextResponse.json({ eligible });
}
