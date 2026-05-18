import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/portal/[token]/report
 * Returns the curated report payload for a valid client portal token.
 * No auth required — the token is the credential.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 4 || token.length > 128) {
    return jsonError('Invalid token', 400);
  }

  const supabase = getServiceClient();

  // Validate portal token and get event_id
  const { data: portalToken, error: tokenError } = await supabase
    .from('client_portal_tokens')
    .select('event_id, is_active, last_used_at')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (tokenError) {
    logger.error('[PORTAL_REPORT] token lookup error:', tokenError.message);
    return jsonError('Server error', 500);
  }

  if (!portalToken) {
    return jsonError('Invalid or expired link', 404);
  }

  const eventId = portalToken.event_id as string;

  // Fetch event details + report in parallel
  const [eventRes, reportRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, slug, type, starts_at, ends_at, venue_name, client_name, client_email')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('event_reports')
      .select('curated_payload, ai_summary, generated_at, schema_version')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (eventRes.error) {
    logger.error('[PORTAL_REPORT] event fetch error:', eventRes.error.message);
    return jsonError('Server error', 500);
  }

  if (!eventRes.data) {
    return jsonError('Event not found', 404);
  }

  // Update last_used_at (fire-and-forget)
  void supabase
    .from('client_portal_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token);

  return NextResponse.json({
    event: eventRes.data,
    report: reportRes.data ?? null,
    has_report: !!reportRes.data,
  });
}
