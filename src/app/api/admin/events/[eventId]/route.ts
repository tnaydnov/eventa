import { NextRequest, NextResponse } from 'next/server';
import { updateEventSchema } from '@/lib/validations';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../_helpers';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/admin/events/[eventId]
 * Update event properties (name, is_active, etc.) with Zod validation.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-patch', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const body = await req.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('events')
      .update(parsed.data)
      .eq('id', eventId)
      .select()
      .maybeSingle();

    if (error) {
      logger.error('[ADMIN_EVENT_PATCH] DB error:', error.message);
      return jsonError('Failed to update event', 500);
    }

    if (!data) {
      return jsonError('Event not found', 404);
    }

    // Evict event status cache if status or is_active changed
    if ('status' in parsed.data || 'is_active' in parsed.data) {
      evictEventStatusCache(eventId);
    }

    adminAuditLog('EVENT_UPDATE', { eventId, changes: Object.keys(parsed.data) }, req);
    return NextResponse.json({ event: data });
  } catch (err) {
    logger.error('[ADMIN_EVENT_PATCH] error:', err);
    return jsonError('Server error', 500);
  }
}
