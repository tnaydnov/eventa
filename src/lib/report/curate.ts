/**
 * Report curation — assembles the analytics payload for a client report.
 * Uses the analytics sub-modules to build a serializable JSON payload.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeEngagementAnalytics,
  computeFunnelAnalytics,
  computeTimeDynamicsAnalytics,
  computeNetworkAnalytics,
  computeCrosstabAnalytics,
  computeSafetyAnalytics,
} from '@/lib/analytics';

export type CuratedReportPayload = {
  schema_version: number;
  generated_at: string;
  event_id: string;
  engagement: Awaited<ReturnType<typeof computeEngagementAnalytics>>;
  funnel: Awaited<ReturnType<typeof computeFunnelAnalytics>>;
  time_dynamics: Awaited<ReturnType<typeof computeTimeDynamicsAnalytics>>;
  network: Awaited<ReturnType<typeof computeNetworkAnalytics>>;
  crosstabs: Awaited<ReturnType<typeof computeCrosstabAnalytics>>;
  safety: Awaited<ReturnType<typeof computeSafetyAnalytics>>;
};

export const REPORT_SCHEMA_VERSION = 1;

export async function curateReport(
  supabase: SupabaseClient,
  eventId: string
): Promise<CuratedReportPayload> {
  const [engagement, funnel, time_dynamics, network, crosstabs, safety] = await Promise.all([
    computeEngagementAnalytics(supabase, eventId),
    computeFunnelAnalytics(supabase, eventId),
    computeTimeDynamicsAnalytics(supabase, eventId),
    computeNetworkAnalytics(supabase, eventId),
    computeCrosstabAnalytics(supabase, eventId),
    computeSafetyAnalytics(supabase, eventId),
  ]);

  return {
    schema_version: REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    event_id: eventId,
    engagement,
    funnel,
    time_dynamics,
    network,
    crosstabs,
    safety,
  };
}
