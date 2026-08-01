/**
 * Safety analytics - blocks, moderation activity, and churn.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SafetyAnalytics = {
  total_blocks: number;
  banned_participants: number;
  deleted_participants: number;
};

export async function computeSafetyAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<SafetyAnalytics> {
  const [blocksRes, bannedRes, deletedRes] = await Promise.all([
    supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('is_banned', true),
    supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('deleted_at', 'is', null),
  ]);

  return {
    total_blocks: blocksRes.count ?? 0,
    banned_participants: bannedRes.count ?? 0,
    deleted_participants: deletedRes.count ?? 0,
  };
}
