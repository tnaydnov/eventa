import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { APP_BASE_URL } from '@/lib/config';

/**
 * Build the full guest-upload portal URL for a given event slug/token.
 */
function buildPortalUrl(slug: string, token: string): string {
  return `${APP_BASE_URL}/guest-upload/${slug}?token=${token}`;
}

/**
 * GET /api/admin/events/[eventId]/portal-token
 * Get the current active portal token and URL for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-portal-token-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('client_portal_tokens')
      .select('id, token, is_active, created_at, last_used_at')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      logger.error('[ADMIN_PORTAL_TOKEN_GET] query error:', error.message);
      return jsonError('Failed to load portal token', 500);
    }

    if (!data) {
      return NextResponse.json({ token: null, portalUrl: null });
    }

    // Fetch event slug for pretty URL
    const { data: event } = await supabase
      .from('events')
      .select('slug')
      .eq('id', eventId)
      .single();

    return NextResponse.json({
      token: data.token,
      portalUrl: buildPortalUrl(event?.slug ?? eventId, data.token),
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
    });
  } catch (err) {
    logger.error('[ADMIN_PORTAL_TOKEN_GET] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * POST /api/admin/events/[eventId]/portal-token
 * Generate or regenerate a portal token. Deactivates any existing token.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-portal-token-post', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const supabase = getServiceClient();

    // Verify event exists
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, slug')
      .eq('id', eventId)
      .single();

    if (evErr || !event) return jsonError('Event not found', 404);

    // Deactivate any existing tokens for this event
    await supabase
      .from('client_portal_tokens')
      .update({ is_active: false })
      .eq('event_id', eventId)
      .eq('is_active', true);

    // Generate new token
    const token = crypto.randomUUID();

    const { error: insertErr } = await supabase
      .from('client_portal_tokens')
      .insert({
        event_id: eventId,
        token,
        is_active: true,
      });

    if (insertErr) {
      logger.error('[ADMIN_PORTAL_TOKEN_POST] insert error:', insertErr.message);
      return jsonError('Failed to generate token', 500);
    }

    adminAuditLog('PORTAL_TOKEN_GENERATE', { eventId }, req);

    return NextResponse.json({
      token,
      portalUrl: buildPortalUrl(event.slug, token),
    });
  } catch (err) {
    logger.error('[ADMIN_PORTAL_TOKEN_POST] error:', err);
    return jsonError('Server error', 500);
  }
}
