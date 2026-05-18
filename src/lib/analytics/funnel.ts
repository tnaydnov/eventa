/**
 * Funnel analytics — computes step-by-step conversion from funnel_events table.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type FunnelStep = {
  step: string;
  count: number;
  conversion_rate: number; // percentage vs previous step (0-100)
};

export type FunnelAnalytics = {
  steps: FunnelStep[];
  top_drop_off: string | null;
};

const ORDERED_STEPS = [
  'qr_scan',
  'join_page_view',
  'otp_requested',
  'otp_verified',
  'setup_started',
  'profile_complete',
];

export async function computeFunnelAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<FunnelAnalytics> {
  const { data, error } = await supabase
    .from('funnel_events')
    .select('step')
    .eq('event_id', eventId);

  if (error || !data) {
    return { steps: [], top_drop_off: null };
  }

  // Count unique sessions per step (deduplicate by step occurrence count)
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.step] = (counts[row.step] ?? 0) + 1;
  }

  const steps: FunnelStep[] = [];
  let prevCount: number | null = null;
  let topDropOff: string | null = null;
  let maxDrop = 0;

  for (const step of ORDERED_STEPS) {
    const count = counts[step] ?? 0;
    const conversion_rate = prevCount !== null && prevCount > 0
      ? Math.round((count / prevCount) * 100)
      : 100;

    if (prevCount !== null) {
      const drop = prevCount - count;
      if (drop > maxDrop) {
        maxDrop = drop;
        topDropOff = step;
      }
    }

    steps.push({ step, count, conversion_rate });
    prevCount = count;
  }

  return { steps, top_drop_off: topDropOff };
}
