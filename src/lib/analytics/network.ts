/**
 * Network analytics — graph density and connection statistics.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type NetworkAnalytics = {
  total_participants: number;
  participants_with_matches: number;
  participants_with_messages: number;
  isolated_participants: number; // no likes sent or received
  avg_likes_sent: number;
  avg_likes_received: number;
};

export async function computeNetworkAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<NetworkAnalytics> {
  const [participantsRes, likesRes] = await Promise.all([
    supabase
      .from('participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('is_banned', false)
      .limit(10_000),
    supabase
      .from('likes')
      .select('from_participant_id, to_participant_id')
      .eq('event_id', eventId)
      .limit(100_000),
  ]);

  const participants = participantsRes.data ?? [];
  const likes = likesRes.data ?? [];

  const N = participants.length;
  if (N === 0) {
    return {
      total_participants: 0,
      participants_with_matches: 0,
      participants_with_messages: 0,
      isolated_participants: 0,
      avg_likes_sent: 0,
      avg_likes_received: 0,
    };
  }

  const likesSentByP: Map<string, number> = new Map();
  const likesReceivedByP: Map<string, number> = new Map();
  const likeSet = new Set(likes.map((l) => `${l.from_participant_id}:${l.to_participant_id}`));

  for (const l of likes) {
    likesSentByP.set(l.from_participant_id, (likesSentByP.get(l.from_participant_id) ?? 0) + 1);
    likesReceivedByP.set(l.to_participant_id, (likesReceivedByP.get(l.to_participant_id) ?? 0) + 1);
  }

  const participantIds = new Set(participants.map((p) => p.id as string));
  let withMatches = 0;
  let isolated = 0;

  for (const id of participantIds) {
    const sent = likesSentByP.get(id) ?? 0;
    const received = likesReceivedByP.get(id) ?? 0;
    if (sent === 0 && received === 0) isolated++;

    // Check if any mutual match exists
    const hasMutualMatch = likes.some(
      (l) =>
        l.from_participant_id === id &&
        likeSet.has(`${l.to_participant_id}:${id}`)
    );
    if (hasMutualMatch) withMatches++;
  }

  const totalSent = likes.length;
  const avgLikesSent = Math.round((totalSent / N) * 10) / 10;
  const avgLikesReceived = avgLikesSent; // symmetric

  // Participants with messages: query conversations count
  const { data: convData } = await supabase
    .from('conversations')
    .select('a_participant_id, b_participant_id')
    .eq('event_id', eventId)
    .limit(50_000);

  const withMessages = new Set<string>();
  for (const c of convData ?? []) {
    withMessages.add(c.a_participant_id as string);
    withMessages.add(c.b_participant_id as string);
  }

  return {
    total_participants: N,
    participants_with_matches: withMatches,
    participants_with_messages: withMessages.size,
    isolated_participants: isolated,
    avg_likes_sent: avgLikesSent,
    avg_likes_received: avgLikesReceived,
  };
}
