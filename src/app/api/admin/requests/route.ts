import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient, generateJoinCode } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { logger } from '@/lib/logger';
import { adminAuditLog } from '@/lib/admin-auth';

/** Generate a 4-char random hex suffix for unique slugs. */
function randomSuffix(): string {
  return crypto.randomBytes(2).toString('hex');
}

/**
 * GET /api/admin/requests
 * List all event requests, ordered pending-first then by created_at desc.
 * Optionally filter by ?status=pending|approved|denied
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-get', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const supabase = getServiceClient();
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');

    let query = supabase
      .from('event_requests')
      .select('id, status, event_type, event_name, starts_at, ends_at, wants_custom_background, poster_choice, selected_template_id, special_requests, wants_guest_messages, contact_preference, contact_name, contact_phone, contact_email, admin_notes, approved_event_id, created_at, reviewed_at')
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('[ADMIN_REQUESTS_GET] DB error:', error.message);
      return jsonError('Failed to load requests', 500);
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    logger.error('[ADMIN_REQUESTS_GET] error:', err);
    return jsonError('Failed to load requests', 500);
  }
}

/**
 * POST /api/admin/requests
 * Approve or deny a request.
 * Body: { requestId: string, action: 'approve' | 'deny', adminNotes?: string }
 *
 * On approve: creates a new event with all the data from the request.
 */
export async function POST(req: NextRequest) {
  const denied = adminGuard(req, 'admin-requests-post', RATE_LIMITS.strict);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { requestId, action, adminNotes } = body;

    if (!requestId || !action || !['approve', 'deny'].includes(action)) {
      return jsonError('Invalid input', 400);
    }

    const supabase = getServiceClient();

    // Fetch the request
    const { data: request, error: fetchErr } = await supabase
      .from('event_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return jsonError('Request not found', 404);
    }

    if (request.status !== 'pending') {
      return jsonError('Request already processed', 400);
    }

    // ── DENY ──
    if (action === 'deny') {
      const { error: updateErr } = await supabase
        .from('event_requests')
        .update({
          status: 'denied',
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) {
        logger.error('[ADMIN_REQUESTS] deny update error:', updateErr.message);
        return jsonError('Failed to deny request', 500);
      }

      adminAuditLog('REQUEST_DENY', { requestId }, req);
      return NextResponse.json({ success: true, action: 'denied' });
    }

    // ── APPROVE ── Create the event automatically
    const eventName = request.event_name || `${request.event_type}-event`;

    // Generate slug
    const base = eventName
      .toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
      .replace(/[\u0590-\u05ff]+/g, '') // strip Hebrew from slug
      .replace(/(^-|-$)/g, '')
      .replace(/-{2,}/g, '-');
    let slug = `${base || 'event'}-${randomSuffix()}`;

    // Ensure slug uniqueness
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${randomSuffix()}`;
    }

    // Create the event
    const { data: newEvent, error: createErr } = await supabase
      .from('events')
      .insert({
        name: eventName,
        slug,
        join_code: generateJoinCode(),
        event_type: request.event_type,
        status: 'active',
        description: request.special_requests || null,
        starts_at: request.starts_at,
        ends_at: request.ends_at,
        is_active: true,
      })
      .select('id, slug')
      .single();

    if (createErr) {
      logger.error('[ADMIN_REQUESTS] event create error:', createErr.message);
      return jsonError('Failed to create event', 500);
    }

    // If the request has a custom background image, upload it to storage
    if (request.wants_custom_background && request.background_base64) {
      try {
        const base64Data = (request.background_base64 as string).replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const storagePath = `backgrounds/${newEvent.id}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('event-assets')
          .upload(storagePath, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadErr) {
          // Get public URL and update event
          const { data: urlData } = supabase.storage
            .from('event-assets')
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            await supabase
              .from('events')
              .update({ background_image: urlData.publicUrl })
              .eq('id', newEvent.id);
          }
        } else {
          logger.warn('[ADMIN_REQUESTS] bg upload failed:', uploadErr.message);
        }
      } catch (bgErr) {
        logger.warn('[ADMIN_REQUESTS] bg processing error:', bgErr);
        // Non-fatal — event is still created
      }
    }

    // Update request as approved
    const { error: updateErr } = await supabase
      .from('event_requests')
      .update({
        status: 'approved',
        admin_notes: adminNotes || null,
        approved_event_id: newEvent.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      logger.warn('[ADMIN_REQUESTS] approve update error:', updateErr.message);
      // Non-fatal — event was already created
    }

    adminAuditLog('REQUEST_APPROVE', { requestId, eventId: newEvent.id, slug }, req);
    logger.info('Event request approved', { requestId, eventId: newEvent.id });

    return NextResponse.json({
      success: true,
      action: 'approved',
      event: newEvent,
    });
  } catch (err) {
    logger.error('[ADMIN_REQUESTS] error:', err);
    return jsonError('Failed to process request', 500);
  }
}
