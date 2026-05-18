/**
 * Engagement analytics — messages, likes, matches, conversation depth.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type EngagementAnalytics = {
  total_likes: number;
  mutual_likes: number;
  total_conversations: number;
  total_messages: number;
  avg_messages_per_conversation: number;
  conversations_with_3plus_messages: number;
  one_message_conversations: number; // conversations with exactly 1 message (no reply)
  dead_matches: number;              // mutual matches that never became conversations
  match_rate: number; // mutual_likes / total_likes (0-100)
};

export async function computeEngagementAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<EngagementAnalytics> {
  const [likesRes, conversationsRes, messagesRes] = await Promise.all([
    supabase
      .from('likes')
      .select('id, from_participant_id, to_participant_id')
      .eq('event_id', eventId)
      .limit(100_000),
    supabase
      .from('conversations')
      .select('id')
      .eq('event_id', eventId)
      .limit(100_000),
    supabase
      .from('messages')
      .select('conversation_id')
      .eq('event_id', eventId)
      .limit(500_000),
  ]);

  const likes = likesRes.data ?? [];
  const conversations = conversationsRes.data ?? [];
  const messages = messagesRes.data ?? [];

  // Count mutual likes
  const likeSet = new Set(
    likes.map((l) => `${l.from_participant_id}:${l.to_participant_id}`)
  );
  const mutualLikes = likes.filter((l) =>
    likeSet.has(`${l.to_participant_id}:${l.from_participant_id}`)
  ).length / 2; // divide by 2 since each match counted twice

  // Messages per conversation
  const msgPerConv: Record<string, number> = {};
  for (const m of messages) {
    msgPerConv[m.conversation_id] = (msgPerConv[m.conversation_id] ?? 0) + 1;
  }
  const convCounts = Object.values(msgPerConv);
  const avgMessages =
    convCounts.length > 0
      ? convCounts.reduce((a, b) => a + b, 0) / convCounts.length
      : 0;
  const deepConvs          = convCounts.filter((c) => c >= 3).length;
  const oneMessageConvs    = convCounts.filter((c) => c === 1).length;
  const deadMatches        = Math.max(Math.round(mutualLikes) - conversations.length, 0);

  return {
    total_likes: likes.length,
    mutual_likes: Math.round(mutualLikes),
    total_conversations: conversations.length,
    total_messages: messages.length,
    avg_messages_per_conversation: Math.round(avgMessages * 10) / 10,
    conversations_with_3plus_messages: deepConvs,
    one_message_conversations: oneMessageConvs,
    dead_matches: deadMatches,
    match_rate:
      likes.length > 0
        ? Math.round((mutualLikes / likes.length) * 2 * 100)
        : 0,
  };
}
