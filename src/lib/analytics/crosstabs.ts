/**
 * Crosstab analytics — gender/age/preference breakdown.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type CrosstabAnalytics = {
  gender_distribution: { label: string; count: number }[];
  age_buckets: { label: string; count: number }[];
  attraction_distribution: { label: string; count: number }[];
};

export async function computeCrosstabAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<CrosstabAnalytics> {
  const { data, error } = await supabase
    .from('participants')
    .select('gender, attracted_to, age')
    .eq('event_id', eventId)
    .eq('is_banned', false)
    .limit(10_000);

  if (error || !data) {
    return {
      gender_distribution: [],
      age_buckets: [],
      attraction_distribution: [],
    };
  }

  // Gender
  const genderMap: Record<string, number> = {};
  const attractionMap: Record<string, number> = {};
  const ageBucketMap: Record<string, number> = {
    '18-24': 0,
    '25-34': 0,
    '35-44': 0,
    '45-54': 0,
    '55+': 0,
  };

  for (const p of data) {
    const g = (p.gender as string) ?? 'unknown';
    genderMap[g] = (genderMap[g] ?? 0) + 1;

    const a = (p.attracted_to as string) ?? 'all';
    attractionMap[a] = (attractionMap[a] ?? 0) + 1;

    const age = typeof p.age === 'number' ? p.age : null;
    if (age !== null) {
      if (age < 25) ageBucketMap['18-24']++;
      else if (age < 35) ageBucketMap['25-34']++;
      else if (age < 45) ageBucketMap['35-44']++;
      else if (age < 55) ageBucketMap['45-54']++;
      else ageBucketMap['55+']++;
    }
  }

  return {
    gender_distribution: Object.entries(genderMap).map(([label, count]) => ({ label, count })),
    age_buckets: Object.entries(ageBucketMap).map(([label, count]) => ({ label, count })),
    attraction_distribution: Object.entries(attractionMap).map(([label, count]) => ({ label, count })),
  };
}
