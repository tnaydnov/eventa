import { redirect } from 'next/navigation';
import { getServiceClient } from '@/lib/supabase';

/**
 * /e/[slug] - Short pretty URL redirect.
 *
 * Looks up the event by slug and redirects to the canonical
 * /dating/[eventSlug] path. This keeps all existing pages/components
 * working while providing a short, shareable URL.
 *
 * For archived events whose slug was recycled, the active event
 * with that slug takes priority (partial unique index ensures only
 * one non-archived event can hold a given slug).
 */
export default async function ShortUrlPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Look up the event by slug (prefer non-archived)
  const supabase = getServiceClient();
  const { data: event } = await supabase
    .from('events')
    .select('slug, status')
    .eq('slug', slug)
    .neq('status', 'archived')
    .maybeSingle();

  if (event) {
    redirect(`/dating/${event.slug}`);
  }

  // Fallback: check archived events (slug may have been recycled/appended)
  const { data: archived } = await supabase
    .from('events')
    .select('original_slug')
    .eq('original_slug', slug)
    .eq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (archived) {
    // The slug was recycled - event no longer available
    redirect(`/not-found`);
  }

  // No event found at all
  redirect(`/not-found`);
}
