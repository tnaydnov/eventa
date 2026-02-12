/**
 * POST /api/secure/compass
 * Thin router — dispatches to individual action handlers based on { action } field:
 *   - request:        Create a compass request (requires mutual interaction)
 *   - accept:         Accept a compass request
 *   - close:          Close/decline/expire a compass session
 *   - location:       Update compass location
 *   - check-eligible: Check if compass is available for a pair
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';

import { handleRequest } from './_actions/request';
import { handleAccept } from './_actions/accept';
import { handleClose } from './_actions/close';
import { handleLocation } from './_actions/location';
import { handleCheckEligible } from './_actions/check-eligible';

export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'compass', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = getServiceClient();

    switch (action) {
      case 'request':
        return handleRequest(session, body, supabase);
      case 'accept':
        return handleAccept(session, body, supabase);
      case 'close':
        return handleClose(session, body, supabase);
      case 'location':
        return handleLocation(session, body, supabase);
      case 'check-eligible':
        return handleCheckEligible(session, body, supabase);
      default:
        return jsonError('Invalid action', 400);
    }
  } catch (err) {
    console.error('[COMPASS] error:', err);
    return jsonError('Server error', 500);
  }
}
