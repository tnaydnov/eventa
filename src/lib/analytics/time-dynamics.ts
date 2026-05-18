/**
 * Time dynamics analytics — activity heatmap by hour.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type TimeDynamicsAnalytics = {
  hourly_activity: { hour: number; count: number }[];
  peak_hour: number | null;
};

export async function computeTimeDynamicsAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<TimeDynamicsAnalytics> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('created_at')
    .eq('event_id', eventId)
    .limit(500_000);

  if (error || !data) {
    return { hourly_activity: [], peak_hour: null };
  }

  const hourCounts: number[] = new Array(24).fill(0);
  for (const row of data) {
    const hour = new Date(row.created_at as string).getHours();
    hourCounts[hour]++;
  }

  const hourly_activity = hourCounts.map((count, hour) => ({ hour, count }));
  const maxCount = Math.max(...hourCounts);
  const peak_hour = maxCount > 0 ? hourCounts.indexOf(maxCount) : null;

  return { hourly_activity, peak_hour };
}
