import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/secure/since?cursor=<ISO timestamp>
 *
 * Consolidated polling-delta endpoint (SECURITY_HARDENING_PLAN §23.4 / R6).
 *
 * The client polling fallback (RealtimeNotificationListener) previously issued ~4
 * independent Supabase queries per poll, per client, straight from the browser. At a
 * crowded venue (hundreds of guests polling every ~8 s) that multiplies into a heavy,
 * synchronized Postgres load. This single endpoint returns ALL the deltas the poller
 * needs in one round trip, computed server-side (connection-pooled, closer to the DB):
 *
 *   - likes              : new likes addressed to me since `cursor`
 *   - messages           : new messages in my conversations (from others) since `cursor`
 *   - myConversationIds  : my current conversation ids (membership, for realtime filtering)
 *   - unseenLikeSenders  : senders of my currently-unseen likes (to reconcile stale highlights)
 *   - serverNow          : the server's clock - the client advances its cursor to this,
 *                          so correctness never depends on the (often skewed) device clock.
 *
 * Read-only. Scoped to the caller's event + participant via the verified session - never
 * trusts client-supplied ids. `cursor` is validated as an ISO timestamp; a missing/invalid
 * cursor falls back to "now" (returns no historical rows, just establishes the baseline).
 */
export async function GET(req: NextRequest) {
  const guard = await secureGuard(req, 'since', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  const myId = session.sub;
  const eventId = session.eid;
  const serverNow = new Date().toISOString();

  // Validate the cursor: must be a parseable timestamp. Fall back to "now" (no backlog)
  // rather than erroring, so a malformed cursor can never wedge a client's catch-up.
  const rawCursor = req.nextUrl.searchParams.get('cursor');
  let cursor = serverNow;
  if (rawCursor) {
    const parsed = Date.parse(rawCursor);
    if (!Number.isNaN(parsed)) cursor = new Date(parsed).toISOString();
  }

  try {
    const supabase = getServiceClient();

    // New likes to me + my conversation memberships in parallel.
    const [likesResult, convsResult, unseenResult] = await Promise.all([
      supabase
        .from('likes')
        .select('id, from_participant_id, created_at')
        .eq('event_id', eventId)
        .eq('to_participant_id', myId)
        .gt('created_at', cursor)
        .order('created_at', { ascending: true }),
      supabase
        .from('conversations')
        .select('id')
        .eq('event_id', eventId)
        .or(`a_participant_id.eq.${myId},b_participant_id.eq.${myId}`),
      // Senders of my currently-unseen likes - lets the client drop stale "like" highlights.
      supabase
        .from('likes')
        .select('from_participant_id')
        .eq('event_id', eventId)
        .eq('to_participant_id', myId)
        .is('seen_at', null),
    ]);

    if (likesResult.error) {
      logger.error('[SINCE] likes query error', { error: likesResult.error.message });
      return jsonError('Server error', 500);
    }
    if (convsResult.error) {
      logger.error('[SINCE] conversations query error', { error: convsResult.error.message });
      return jsonError('Server error', 500);
    }

    const myConversationIds = (convsResult.data ?? []).map((c) => c.id);

    // New messages in my conversations from other participants since the cursor.
    let messages: Array<{
      id: string; sender_participant_id: string; conversation_id: string;
      text: string | null; type: string; created_at: string;
    }> = [];
    if (myConversationIds.length > 0) {
      const msgResult = await supabase
        .from('messages')
        .select('id, sender_participant_id, conversation_id, text, type, created_at')
        .eq('event_id', eventId)
        .neq('sender_participant_id', myId)
        .in('conversation_id', myConversationIds)
        .gt('created_at', cursor)
        .order('created_at', { ascending: true });
      if (msgResult.error) {
        logger.error('[SINCE] messages query error', { error: msgResult.error.message });
        return jsonError('Server error', 500);
      }
      messages = msgResult.data ?? [];
    }

    const unseenLikeSenders = unseenResult.error
      ? null // signal "unknown" so the client skips reconcile rather than wrongly clearing highlights
      : [...new Set((unseenResult.data ?? []).map((l) => l.from_participant_id))];

    return NextResponse.json({
      likes: likesResult.data ?? [],
      messages,
      myConversationIds,
      unseenLikeSenders,
      serverNow,
    });
  } catch (err) {
    logger.error('[SINCE] unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return jsonError('Server error', 500);
  }
}
