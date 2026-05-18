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
  one_message_conversations: number;
  dead_matches: number;
  match_rate: number;
  first_message_by_men: number;   // # conversations where a man sent the first message
  first_message_by_women: number; // # conversations where a woman sent the first message
  ghosted_conversations: number;  // conversations where only one side ever wrote
  first_like_by_men: number;      // # men who sent at least one like
  first_like_by_women: number;    // # women who sent at least one like
};

export async function computeEngagementAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<EngagementAnalytics> {
  const [likesRes, conversationsRes, messagesRes, participantsRes] = await Promise.all([
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
      .select('conversation_id, sender_participant_id, created_at')
      .eq('event_id', eventId)
      .limit(500_000),
    supabase
      .from('participants')
      .select('id, gender')
      .eq('event_id', eventId)
      .eq('is_banned', false)
      .neq('display_name', '')
      .limit(10_000),
  ]);

  const likes = likesRes.data ?? [];
  const conversations = conversationsRes.data ?? [];
  const messages = messagesRes.data ?? [];
  const participants = participantsRes.data ?? [];
  const pGender = new Map<string, string>(participants.map(p => [p.id as string, p.gender as string]));

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
  const deepConvs       = convCounts.filter((c) => c >= 3).length;
  const oneMessageConvs = convCounts.filter((c) => c === 1).length;
  const deadMatches     = Math.max(Math.round(mutualLikes) - conversations.length, 0);

  // First message per conversation (earliest created_at wins)
  const firstMsgSender = new Map<string, { senderId: string; time: string }>();
  const sendersPerConv = new Map<string, Set<string>>();
  for (const m of messages) {
    const convId   = m.conversation_id as string;
    const senderId = m.sender_participant_id as string;
    const time     = m.created_at as string;
    if (!sendersPerConv.has(convId)) sendersPerConv.set(convId, new Set());
    sendersPerConv.get(convId)!.add(senderId);
    const cur = firstMsgSender.get(convId);
    if (!cur || time < cur.time) firstMsgSender.set(convId, { senderId, time });
  }

  let firstMessageByMen = 0, firstMessageByWomen = 0, ghostedConversations = 0;
  for (const [convId, entry] of firstMsgSender) {
    const g = pGender.get(entry.senderId);
    if (g === 'male')   firstMessageByMen++;
    else if (g === 'female') firstMessageByWomen++;
    if ((sendersPerConv.get(convId)?.size ?? 0) < 2) ghostedConversations++;
  }

  // First like by gender: count unique participants who sent any like, by gender
  let firstLikeByMen = 0, firstLikeByWomen = 0;
  const likeSenderIds = new Set(likes.map(l => l.from_participant_id as string));
  for (const pid of likeSenderIds) {
    const g = pGender.get(pid);
    if (g === 'male')   firstLikeByMen++;
    else if (g === 'female') firstLikeByWomen++;
  }

  return {
    total_likes: likes.length,
    mutual_likes: Math.round(mutualLikes),
    total_conversations: conversations.length,
    total_messages: messages.length,
    avg_messages_per_conversation: Math.round(avgMessages * 10) / 10,
    conversations_with_3plus_messages: deepConvs,
    one_message_conversations: oneMessageConvs,
    dead_matches: deadMatches,
    first_message_by_men: firstMessageByMen,
    first_message_by_women: firstMessageByWomen,
    ghosted_conversations: ghostedConversations,
    first_like_by_men: firstLikeByMen,
    first_like_by_women: firstLikeByWomen,
    match_rate:
      likes.length > 0
        ? Math.round((mutualLikes / likes.length) * 2 * 100)
        : 0,
  };
}
