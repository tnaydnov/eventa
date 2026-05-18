/**
 * Safety analytics — reports, blocks, moderation activity.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SafetyAnalytics = {
  total_blocks: number;
  total_reports: number;
  banned_participants: number;
};

export async function computeSafetyAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<SafetyAnalytics> {
  const [blocksRes, reportsRes, bannedRes] = await Promise.all([
    supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('is_banned', true),
  ]);

  return {
    total_blocks: blocksRes.count ?? 0,
    total_reports: reportsRes.count ?? 0,
    banned_participants: bannedRes.count ?? 0,
  };
}
