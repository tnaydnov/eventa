import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';

/**
 * GET /api/admin/events/[eventId]/stats
 * Returns aggregate statistics for an event.
 * All 5 count queries run in parallel for speed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-stats', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    /** Count rows in a table filtered by event_id. */
    const countByEvent = (table: string) =>
      supabase.from(table).select('*', { count: 'exact', head: true }).eq('event_id', eventId);

    const [participants, conversations, likes, messages, blocks] = await Promise.all([
      countByEvent('participants'),
      countByEvent('conversations'),
      countByEvent('likes'),
      countByEvent('messages'),
      countByEvent('blocks'),
    ]);

    return NextResponse.json({
      participants: participants.count || 0,
      conversations: conversations.count || 0,
      likes: likes.count || 0,
      messages: messages.count || 0,
      blocks: blocks.count || 0,
    });
  } catch (err) {
    console.error('[ADMIN_STATS] error:', err);
    return jsonError('Failed to load stats', 500);
  }
}
