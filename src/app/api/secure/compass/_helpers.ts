/**
 * Shared helpers for compass action handlers.
 */
import { SupabaseClient } from '@supabase/supabase-js';

/** Valid latitude range. */
export const LAT_MIN = -90;
export const LAT_MAX = 90;

/** Valid longitude range. */
export const LNG_MIN = -180;
export const LNG_MAX = 180;

/**
 * Check if two participants have mutual interaction (both liked each other
 * OR both sent at least one message to each other).
 */
export async function hasMutualInteraction(
  supabase: SupabaseClient,
  eventId: string,
  meId: string,
  otherId: string
): Promise<boolean> {
  // Check mutual likes
  const [{ count: iLikedThem }, { count: theyLikedMe }] = await Promise.all([
    supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('from_participant_id', meId)
      .eq('to_participant_id', otherId),
    supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('from_participant_id', otherId)
      .eq('to_participant_id', meId),
  ]);

  if ((iLikedThem ?? 0) > 0 && (theyLikedMe ?? 0) > 0) return true;

  // Check mutual messages
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', eventId)
    .or(
      `and(a_participant_id.eq.${meId},b_participant_id.eq.${otherId}),and(a_participant_id.eq.${otherId},b_participant_id.eq.${meId})`
    )
    .limit(1);

  if (!convs || convs.length === 0) return false;

  const [{ data: myMsgs }, { data: theirMsgs }] = await Promise.all([
    supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', convs[0].id)
      .eq('sender_participant_id', meId)
      .limit(1),
    supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', convs[0].id)
      .eq('sender_participant_id', otherId)
      .limit(1),
  ]);

  return (myMsgs?.length ?? 0) > 0 && (theirMsgs?.length ?? 0) > 0;
}

/**
 * Find a conversation between two participants, or create one if it doesn't exist.
 */
export async function findOrCreateConversation(
  supabase: SupabaseClient,
  eventId: string,
  userA: string,
  userB: string
): Promise<string | null> {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', eventId)
    .or(
      `and(a_participant_id.eq.${userA},b_participant_id.eq.${userB}),and(a_participant_id.eq.${userB},b_participant_id.eq.${userA})`
    )
    .limit(1);

  if (convs && convs.length > 0) return convs[0].id;

  const { data: newConv } = await supabase
    .from('conversations')
    .insert({ event_id: eventId, a_participant_id: userA, b_participant_id: userB })
    .select('id')
    .single();

  return newConv?.id ?? null;
}
