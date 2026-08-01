/**
 * Time dynamics analytics - activity heatmap by hour.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type TimeDynamicsAnalytics = {
  /** ISO timestamp for the start of each UTC hour bucket, so the browser renders in local time */
  hourly_activity: { timestamp: string; count: number }[];
  peak_hour: number | null; // UTC hour of peak activity
};

export async function computeTimeDynamicsAnalytics(
  supabase: SupabaseClient,
  eventId: string,
  eventStart?: string,
  eventEnd?: string
): Promise<TimeDynamicsAnalytics> {
  let query = supabase
    .from('activity_log')
    .select('created_at')
    .eq('event_id', eventId);
  if (eventStart) query = query.gte('created_at', eventStart);
  if (eventEnd)   query = query.lte('created_at', eventEnd);
  const { data, error } = await query.limit(500_000);

  if (error || !data) {
    return { hourly_activity: [], peak_hour: null };
  }

  // Bucket by UTC hour - store as ISO timestamp so the browser converts to local time correctly
  const hourBuckets = new Map<number, number>();
  for (const row of data) {
    const d = new Date(row.created_at as string);
    const utcHourMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
    hourBuckets.set(utcHourMs, (hourBuckets.get(utcHourMs) ?? 0) + 1);
  }

  const sorted = [...hourBuckets.entries()].sort(([a], [b]) => a - b);
  const hourly_activity = sorted.map(([ms, count]) => ({
    timestamp: new Date(ms).toISOString(),
    count,
  }));

  const peakEntry = sorted.length > 0
    ? sorted.reduce((max, cur) => cur[1] > max[1] ? cur : max, sorted[0])
    : null;
  const peak_hour = peakEntry ? new Date(peakEntry[0]).getUTCHours() : null;

  return { hourly_activity, peak_hour };
}
