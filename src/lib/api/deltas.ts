import { fetchWithRetry } from './fetch-retry';

/** A new like addressed to the current participant. */
export interface DeltaLike {
  id: string;
  from_participant_id: string;
  created_at: string;
}

/** A new message in one of the current participant's conversations. */
export interface DeltaMessage {
  id: string;
  sender_participant_id: string;
  conversation_id: string;
  text: string | null;
  type: string;
  created_at: string;
}

/** Consolidated polling deltas returned by GET /api/secure/since. */
export interface NotificationDeltas {
  likes: DeltaLike[];
  messages: DeltaMessage[];
  myConversationIds: string[];
  /** Senders of currently-unseen likes, or `null` when the server couldn't compute it
   *  (in which case the client must NOT reconcile/clear highlights). */
  unseenLikeSenders: string[] | null;
  /** Server clock - advance the poll cursor to this so correctness never depends on the device clock. */
  serverNow: string;
}

/**
 * Fetch all polling deltas since `cursor` in a single request (SECURITY_HARDENING_PLAN §23.4/R6).
 *
 * Replaces the poller's ~4 direct Supabase queries with one consolidated, session-scoped
 * API call (queries run server-side, connection-pooled). Returns `null` on failure so the
 * caller can keep its existing cursor and retry on the next tick - never advancing past
 * data it didn't actually receive.
 */
export async function getNotificationDeltas(cursor: string): Promise<NotificationDeltas | null | 'rate-limited'> {
  try {
    const res = await fetchWithRetry(
      `/api/secure/since?cursor=${encodeURIComponent(cursor)}`,
      { method: 'GET' },
    );
    if (res.status === 429) return 'rate-limited';
    if (!res.ok) return null;
    return (await res.json()) as NotificationDeltas;
  } catch (err) {
    console.error('[getNotificationDeltas] error:', err);
    return null;
  }
}
