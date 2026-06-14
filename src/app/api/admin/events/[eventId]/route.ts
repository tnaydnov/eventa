import { NextRequest, NextResponse } from 'next/server';
import { updateEventSchema } from '@/lib/validations';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../_helpers';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { isReservedSlug } from '@/lib/slug';
import { encryptPii, computeBlindIndex, decryptEventRow } from '@/lib/pii';

/**
 * PATCH /api/admin/events/[eventId]
 * Update event properties (name, is_active, etc.) with Zod validation.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = await adminGuard(req, 'admin-patch', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const body = await req.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    if (parsed.data.slug) {
      const nextSlug = parsed.data.slug.toLowerCase();

      if (isReservedSlug(nextSlug)) {
        return NextResponse.json(
          { error: 'כתובת זו שמורה למערכת ולא ניתן להשתמש בה', details: { slug: ['Reserved slug'] } },
          { status: 400 }
        );
      }

      const { data: existingSlug, error: slugCheckError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', nextSlug)
        .neq('id', eventId)
        .maybeSingle();

      if (slugCheckError) {
        logger.error('[ADMIN_EVENT_PATCH] slug check error:', slugCheckError.message);
        return jsonError('Failed to update event', 500);
      }

      if (existingSlug) {
        return NextResponse.json(
          { error: 'כתובת כבר בשימוש', details: { slug: ['Slug already exists'] } },
          { status: 409 }
        );
      }

      parsed.data.slug = nextSlug;
    }

    // ── Date change guards ──
    const isDatesChange = 'starts_at' in parsed.data || 'ends_at' in parsed.data;
    if (isDatesChange) {
      // Fetch current event to check status
      const { data: current, error: fetchErr } = await supabase
        .from('events')
        .select('status')
        .eq('id', eventId)
        .maybeSingle();

      if (fetchErr || !current) {
        return jsonError('Event not found', 404);
      }

      if (current.status === 'ended' || current.status === 'archived') {
        return NextResponse.json(
          { error: 'לא ניתן לעדכן תאריכים לאחר שהאירוע הסתיים או עבר לארכיון' },
          { status: 409 }
        );
      }
    }

    // Build update payload, adding _enc/_bi siblings for any PII fields present
    const updateData: Record<string, unknown> = { ...parsed.data };
    // Strip plaintext PII columns — these have been dropped in migration 047
    delete updateData.client_name;
    delete updateData.client_email;
    delete updateData.client_phone;
    if ('client_name' in parsed.data) {
      updateData.client_name_enc = encryptPii(parsed.data.client_name ?? null);
    }
    if ('client_email' in parsed.data) {
      updateData.client_email_enc = encryptPii(parsed.data.client_email ?? null);
      updateData.client_email_bi  = computeBlindIndex(parsed.data.client_email ?? null);
    }
    if ('client_phone' in parsed.data) {
      updateData.client_phone_enc = encryptPii(parsed.data.client_phone ?? null);
      updateData.client_phone_bi  = computeBlindIndex(parsed.data.client_phone ?? null);
    }

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .maybeSingle();

    if (error) {
      logger.error('[ADMIN_EVENT_PATCH] DB error:', error.message);
      return jsonError('Failed to update event', 500);
    }

    if (!data) {
      return jsonError('Event not found', 404);
    }

    const decrypted = decryptEventRow(data);

    // Evict event status cache if status or is_active changed
    if ('status' in parsed.data || 'is_active' in parsed.data) {
      evictEventStatusCache(eventId);
    }

    // ── Warn if pre-event messages were already sent ──
    let preEventSentCount = 0;
    if (isDatesChange) {
      const { count } = await supabase
        .from('event_guest_phones')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('wa_pre_event_sent', true);
      preEventSentCount = count ?? 0;
    }

    adminAuditLog('EVENT_UPDATE', { eventId, changes: Object.keys(parsed.data) }, req);
    return NextResponse.json({ event: decrypted, preEventSentCount });
  } catch (err) {
    logger.error('[ADMIN_EVENT_PATCH] error:', err);
    return jsonError('Server error', 500);
  }
}
