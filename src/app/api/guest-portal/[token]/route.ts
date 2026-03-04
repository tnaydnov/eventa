import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { guestPhoneSchema } from '@/lib/validations';
import { normalizePhone, isValidIsraeliMobile, formatPhoneDisplay } from '@/lib/messaging/phone-utils';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { MAX_GUEST_NAME_LENGTH, MAX_GUEST_PHONES_PER_EVENT } from '@/lib/config';
import {
  processGuestUpload,
  MAX_UPLOAD_FILE_SIZE,
  isAllowedUploadFile,
} from '@/lib/guest-upload';

// ג”€ג”€ג”€ Helpers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Number of guests per page in the portal list view. */
const PAGE_SIZE = 50;

/**
 * Validate portal token and return event data.
 * Returns null if invalid or expired.
 */
async function validatePortalToken(
  token: string,
  supabase: ReturnType<typeof getServiceClient>
) {
  const { data, error } = await supabase
    .from('client_portal_tokens')
    .select('id, event_id, token, is_active')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  // Update last_used_at
  await supabase
    .from('client_portal_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

/**
 * Update event guest list status fields after add/remove.
 */
async function updateGuestListStatus(
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string
) {
  const { count } = await supabase
    .from('event_guest_phones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  const total = count ?? 0;
  await supabase
    .from('events')
    .update({
      guest_list_uploaded: total > 0,
      guest_list_uploaded_at: total > 0 ? new Date().toISOString() : null,
      guest_list_count: total,
    })
    .eq('id', eventId);
}

// ג”€ג”€ג”€ GET: Portal data + guest list ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

/**
 * GET /api/guest-portal/[token]
 * Validate token, return event info + paginated masked guest list.
 * Query params: ?page=1
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit by token (10/min)
  const rl = checkRateLimit(`portal-get:${token}`, RATE_LIMITS.upload);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  try {
    const supabase = getServiceClient();
    const portalData = await validatePortalToken(token, supabase);
    if (!portalData) {
      return jsonError('Invalid or expired link', 401);
    }

    const eventId = portalData.event_id;

    // Load event info
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select(
        'id, name, slug, starts_at, ends_at, status, wa_messages_enabled, guest_list_uploaded, guest_list_count'
      )
      .eq('id', eventId)
      .single();

    if (evErr || !event) {
      return jsonError('Event not found', 404);
    }

    // Block portal access if WA messaging is disabled for this event
    if (!event.wa_messages_enabled) {
      return jsonError('שירות ההודעות אינו פעיל עבור אירוע זה - הפורטל לא זמין', 403);
    }

    // Check if event is archived or has already started (portal locked)
    const isReadOnly = event.status === 'archived' || (event.starts_at && new Date(event.starts_at) <= new Date());

    // Pagination & search
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const search = (url.searchParams.get('search') || '').trim().slice(0, 100);
    const offset = (page - 1) * PAGE_SIZE;

    // Build guest query with optional search filter
    let guestQuery = supabase
      .from('event_guest_phones')
      .select('id, phone, guest_name, wa_pre_event_sent, created_at', {
        count: 'exact',
      })
      .eq('event_id', eventId);

    if (search) {
      // Sanitize search input to prevent PostgREST filter injection
      // The .or() method parses commas as OR separators and dots as operators
      const sanitized = search.replace(/[,.()\\/]/g, '');
      // Normalize local phone input (0505752650 → +972505752650) for DB match
      const normalized = normalizePhone(sanitized);
      const digits = sanitized.replace(/[^\d]/g, '');
      if (normalized) {
        // Exact E.164 match or name search
        guestQuery = guestQuery.or(`guest_name.ilike.%${sanitized}%,phone.eq.${normalized}`);
      } else if (digits.length >= 3) {
        // Partial digit search or name search
        guestQuery = guestQuery.or(`guest_name.ilike.%${sanitized}%,phone.like.%${digits}%`);
      } else {
        // Name-only search
        guestQuery = guestQuery.ilike('guest_name', `%${sanitized}%`);
      }
    }

    const { data: guests, count } = await guestQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const total = count ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Format phone numbers for display (no masking - client uploaded these)
    const formattedGuests = (guests || []).map(
      (g: {
        id: string;
        phone: string;
        guest_name: string | null;
        wa_pre_event_sent: boolean;
        created_at: string;
      }) => ({
        id: g.id,
        phone: formatPhoneDisplay(g.phone),
        name: g.guest_name || null,
        sent: g.wa_pre_event_sent,
        createdAt: g.created_at,
      })
    );

    // Determine upload status
    let uploadStatus: string;
    const eventStarted = event.starts_at && new Date(event.starts_at) <= new Date();
    if (event.status === 'archived') {
      uploadStatus = 'archived';
    } else if (eventStarted) {
      uploadStatus = 'started';
    } else if (!event.guest_list_uploaded || total === 0) {
      uploadStatus = 'empty';
    } else {
      const sentCount = (guests || []).filter(
        (g: { wa_pre_event_sent: boolean }) => g.wa_pre_event_sent
      ).length;
      uploadStatus = sentCount > 0 ? 'sent' : 'uploaded';
    }

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        status: event.status,
        waMessagesEnabled: event.wa_messages_enabled,
      },
      guests: formattedGuests,
      total,
      page,
      totalPages,
      uploadStatus,
      isReadOnly,
    });
  } catch (err) {
    logger.error('[GUEST_PORTAL_GET] error:', err);
    return jsonError('Server error', 500);
  }
}

// ג”€ג”€ג”€ POST: Upload file or add single phone ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

/**
 * POST /api/guest-portal/[token]
 * Upload guest phone file (multipart) or add single phone (JSON).
 *
 * File upload: Content-Type: multipart/form-data with "file" field
 * Single add:  Content-Type: application/json with { phone, name? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit (strict for writes)
  const rl = checkRateLimit(`portal-post:${token}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  try {
    const supabase = getServiceClient();
    const portalData = await validatePortalToken(token, supabase);
    if (!portalData) {
      return jsonError('Invalid or expired link', 401);
    }

    const eventId = portalData.event_id;

    // Check event is not archived, not started, and WA enabled
    const { data: evPost } = await supabase
      .from('events')
      .select('id, status, starts_at, wa_messages_enabled')
      .eq('id', eventId)
      .single();

    if (!evPost || evPost.status === 'archived') {
      return jsonError('׳”׳׳™׳¨׳•׳¢ ׳”׳¡׳×׳™׳™׳ - ׳׳ ׳ ׳™׳×׳ ׳׳¢׳“׳›׳ ׳׳× ׳”׳¨׳©׳™׳׳”', 400);
    }

    if (!evPost.wa_messages_enabled) {
      return jsonError('שירות ההודעות אינו פעיל עבור אירוע זה - הפורטל לא זמין', 403);
    }

    if (evPost.starts_at && new Date(evPost.starts_at) <= new Date()) {
      return jsonError('׳”׳׳™׳¨׳•׳¢ ׳›׳‘׳¨ ׳”׳×׳—׳™׳ - ׳׳ ׳ ׳™׳×׳ ׳׳¢׳“׳›׳ ׳׳× ׳”׳¨׳©׳™׳׳”', 400);
    }

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return await handleFileUpload(req, supabase, eventId);
    }

    return await handleSingleAdd(req, supabase, eventId);
  } catch (err) {
    logger.error('[GUEST_PORTAL_POST] error:', err);
    return jsonError('Server error', 500);
  }
}

async function handleFileUpload(
  req: NextRequest,
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string
) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return jsonError('No file provided', 400);
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    return jsonError('׳”׳§׳•׳‘׳¥ ׳’׳“׳•׳ ׳׳“׳™ (׳׳§׳¡׳™׳׳•׳ 5MB)', 400);
  }

  if (!isAllowedUploadFile(file.name)) {
    return jsonError('׳”׳§׳•׳‘׳¥ ׳—׳™׳™׳‘ ׳׳”׳™׳•׳× ׳‘׳₪׳•׳¨׳׳˜ Excel (.xlsx) ׳׳• CSV (.csv)', 400);
  }

  // Check current count
  const { count: currentCount } = await supabase
    .from('event_guest_phones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if ((currentCount ?? 0) >= MAX_GUEST_PHONES_PER_EVENT) {
    return jsonError(
      `׳”׳’׳¢׳×׳ ׳׳׳§׳¡׳™׳׳•׳ ${MAX_GUEST_PHONES_PER_EVENT} ׳׳•׳¨׳—׳™׳`,
      400
    );
  }

  // Get existing phones for dedup
  const { data: existing } = await supabase
    .from('event_guest_phones')
    .select('phone')
    .eq('event_id', eventId);

  const existingPhones = new Set((existing || []).map((e: { phone: string }) => e.phone));

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await processGuestUpload(buffer, file.name, existingPhones);

  if (!result.validGuests.length && result.errors.length > 0) {
    return NextResponse.json({
      success: false,
      added: 0,
      duplicates: result.duplicates,
      invalid: result.errors.length,
      errors: result.errors.slice(0, 20), // Cap error list
      totalInList: currentCount ?? 0,
    });
  }

  // Insert valid rows
  if (result.validGuests.length > 0) {
    const rows = result.validGuests.map((g: { phone: string; guest_name: string | null }) => ({
      event_id: eventId,
      phone: g.phone,
      guest_name: g.guest_name || null,
    }));

    const { error: insertErr } = await supabase
      .from('event_guest_phones')
      .insert(rows);

    if (insertErr) {
      logger.error('[GUEST_PORTAL_UPLOAD] insert error:', insertErr.message);
      return jsonError('Failed to save guest list', 500);
    }
  }

  await updateGuestListStatus(supabase, eventId);

  // Get updated count
  const { count: newCount } = await supabase
    .from('event_guest_phones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  return NextResponse.json({
    success: true,
    added: result.validGuests.length,
    duplicates: result.duplicates,
    invalid: result.errors.length,
    errors: result.errors.slice(0, 20),
    totalInList: newCount ?? 0,
  });
}

async function handleSingleAdd(
  req: NextRequest,
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string
) {
  const body = await req.json();
  const parsed = guestPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('׳׳¡׳₪׳¨ ׳”׳˜׳׳₪׳•׳ ׳׳ ׳×׳§׳™׳', 400);
  }

  const normalized = normalizePhone(parsed.data.phone);
  if (!normalized || !isValidIsraeliMobile(normalized)) {
    return jsonError('׳¨׳§ ׳׳¡׳₪׳¨׳™ ׳¡׳׳•׳׳¨ ׳™׳©׳¨׳׳׳™ (05X) ׳ ׳×׳׳›׳™׳', 400);
  }

  // Check current count
  const { count: currentCount } = await supabase
    .from('event_guest_phones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if ((currentCount ?? 0) >= MAX_GUEST_PHONES_PER_EVENT) {
    return jsonError(
      `׳”׳’׳¢׳×׳ ׳׳׳§׳¡׳™׳׳•׳ ${MAX_GUEST_PHONES_PER_EVENT} ׳׳•׳¨׳—׳™׳`,
      400
    );
  }

  // Check for duplicate
  const { data: dup } = await supabase
    .from('event_guest_phones')
    .select('id')
    .eq('event_id', eventId)
    .eq('phone', normalized)
    .maybeSingle();

  if (dup) {
    return jsonError('׳”׳׳¡׳₪׳¨ ׳›׳‘׳¨ ׳§׳™׳™׳ ׳‘׳¨׳©׳™׳׳”', 409);
  }

  const nameVal = parsed.data.name ?? '';
  const guestName = nameVal
    ? sanitizeWithLimit(nameVal, MAX_GUEST_NAME_LENGTH)
    : null;

  const { error: insertErr } = await supabase
    .from('event_guest_phones')
    .insert({
      event_id: eventId,
      phone: normalized,
      guest_name: guestName,
    });

  if (insertErr) {
    logger.error('[GUEST_PORTAL_ADD] insert error:', insertErr.message);
    return jsonError('Failed to add guest', 500);
  }

  await updateGuestListStatus(supabase, eventId);

  const { count: newCount } = await supabase
    .from('event_guest_phones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  return NextResponse.json({
    success: true,
    totalInList: newCount ?? 0,
  });
}

// ג”€ג”€ג”€ DELETE: Remove phone from list ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

/**
 * DELETE /api/guest-portal/[token]
 * Remove a phone from the guest list by ID.
 * Body: { phoneId: "uuid" }
 * Cannot remove after pre-event message sent.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rl = checkRateLimit(`portal-delete:${token}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  try {
    const supabase = getServiceClient();
    const portalData = await validatePortalToken(token, supabase);
    if (!portalData) {
      return jsonError('Invalid or expired link', 401);
    }

    const eventId = portalData.event_id;


    // Check event is not archived, not started, and WA enabled
    const { data: evDel } = await supabase
      .from('events')
      .select('id, status, starts_at, wa_messages_enabled')
      .eq('id', eventId)
      .single();

    if (!evDel || evDel.status === 'archived') {
      return jsonError('׳”׳׳™׳¨׳•׳¢ ׳”׳¡׳×׳™׳™׳ - ׳׳ ׳ ׳™׳×׳ ׳׳¢׳“׳›׳ ׳׳× ׳”׳¨׳©׳™׳׳”', 400);
    }

    if (!evDel.wa_messages_enabled) {
      return jsonError('שירות ההודעות אינו פעיל עבור אירוע זה - הפורטל לא זמין', 403);
    }

    if (evDel.starts_at && new Date(evDel.starts_at) <= new Date()) {
      return jsonError('׳”׳׳™׳¨׳•׳¢ ׳›׳‘׳¨ ׳”׳×׳—׳™׳ - ׳׳ ׳ ׳™׳×׳ ׳׳¢׳“׳›׳ ׳׳× ׳”׳¨׳©׳™׳׳”', 400);
    }

    const body = await req.json();
    const phoneId = body?.phoneId;
    if (!phoneId || typeof phoneId !== 'string') {
      return jsonError('Missing phoneId', 400);
    }

    // UUID format check
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(phoneId)) {
      return jsonError('Invalid phoneId format', 400);
    }

    // Check if the phone exists and belongs to this event
    const { data: phone } = await supabase
      .from('event_guest_phones')
      .select('id, wa_pre_event_sent')
      .eq('id', phoneId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (!phone) {
      return jsonError('Phone not found', 404);
    }

    if (phone.wa_pre_event_sent) {
      return jsonError(
        '׳׳ ׳ ׳™׳×׳ ׳׳”׳¡׳™׳¨ ׳׳¡׳₪׳¨ ׳©׳›׳‘׳¨ ׳ ׳©׳׳—׳” ׳׳׳™׳• ׳”׳•׳“׳¢׳”',
        400
      );
    }

    const { error: delErr } = await supabase
      .from('event_guest_phones')
      .delete()
      .eq('id', phoneId);

    if (delErr) {
      logger.error('[GUEST_PORTAL_DELETE] error:', delErr.message);
      return jsonError('Failed to remove guest', 500);
    }

    await updateGuestListStatus(supabase, eventId);

    const { count: newCount } = await supabase
      .from('event_guest_phones')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    return NextResponse.json({
      success: true,
      totalInList: newCount ?? 0,
    });
  } catch (err) {
    logger.error('[GUEST_PORTAL_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
