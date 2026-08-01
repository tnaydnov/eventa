import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { guestPhoneSchema } from '@/lib/validations';
import { normalizePhone, isValidIsraeliMobile, formatPhoneDisplay } from '@/lib/messaging/phone-utils';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { MAX_GUEST_NAME_LENGTH, MAX_GUEST_PHONES_PER_EVENT } from '@/lib/config';
import { GUEST_PHONE_CONSENT_VERSION } from '@/lib/legal-versions';
import {
  processGuestUpload,
  MAX_UPLOAD_FILE_SIZE,
  isAllowedUploadFile,
} from '@/lib/guest-upload';
import { jsonError } from '@/lib/route-helpers';
import { phoneWriteFields, phoneLookupFilter, decryptGuestPhoneRow, encryptPii } from '@/lib/pii';

// ─── Constants ────────────────────────────────────────────────

/** Portal locks for edits this many hours before event start. */
const PORTAL_LOCKOUT_HOURS_BEFORE = 5;

// ג”€ג”€ג”€ Helpers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

/** Escape LIKE/ILIKE wildcard characters in user input. */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
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
        'id, name, slug, starts_at, ends_at, status, wa_messages_enabled, guest_list_uploaded, guest_list_count, guest_phone_consent_at'
      )
      .eq('id', eventId)
      .maybeSingle();

    if (evErr || !event) {
      return jsonError('Event not found', 404);
    }

    // Block portal access if messaging is disabled for this event
    if (!event.wa_messages_enabled) {
      return jsonError('שירות ההודעות אינו פעיל עבור אירוע זה - הפורטל לא זמין', 403);
    }

    // Portal is read-only once we're within PORTAL_LOCKOUT_HOURS_BEFORE of event start
    const lockoutTime = event.starts_at
      ? new Date(new Date(event.starts_at).getTime() - PORTAL_LOCKOUT_HOURS_BEFORE * 60 * 60 * 1000)
      : null;
    const isReadOnly = event.status === 'archived'
      || (lockoutTime !== null && new Date() >= lockoutTime);

    // Pagination & search
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const search = (url.searchParams.get('search') || '').trim().slice(0, 100);
    const offset = (page - 1) * PAGE_SIZE;

    // Build guest query with optional search filter
    let guestQuery = supabase
      .from('event_guest_phones')
      .select('id, phone_enc, phone_bi, guest_name_enc, wa_pre_event_sent, created_at', {
        count: 'exact',
      })
      .eq('event_id', eventId);

    if (search) {
      // Sanitize search input to prevent PostgREST filter injection
      // The .or() method parses commas as OR separators and dots as operators
      const sanitized = search.replace(/[,.()\\/]/g, '');
      // Normalize local phone input (0501234567 → +972501234567) for DB match
      const normalized = normalizePhone(sanitized);
      if (normalized) {
        // Exact blind-index match on phone, or name-enc search is not feasible;
        // search by phone_bi (blind index exact match only after encryption)
        const { column: pc, value: pv } = phoneLookupFilter(normalized);
        guestQuery = guestQuery.eq(pc, pv);
      } else if (sanitized.length >= 2) {
        // Name search is not possible on encrypted data; skip search
        // (guest_name is fully encrypted — no ILIKE on ciphertext)
      }
    }

    const { data: guests, count } = await guestQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const total = count ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Format phone numbers for display (decrypt first, then format for display)
    const formattedGuests = (guests || []).map(
      (g: {
        id: string;
        phone_enc?: string | null;
        phone_bi?: string | null;
        guest_name_enc?: string | null;
        wa_pre_event_sent: boolean;
        created_at: string;
      }) => {
        const decrypted = decryptGuestPhoneRow(g);
        return {
          id: g.id,
          phone: decrypted.phone ? formatPhoneDisplay(decrypted.phone) : '',
          name: decrypted.guest_name || null,
          sent: g.wa_pre_event_sent,
          createdAt: g.created_at,
        };
      }
    );

    // Determine upload status
    let uploadStatus: string;
    const eventStarted = event.starts_at && new Date(event.starts_at) <= new Date();
    const portalLocked = lockoutTime !== null && new Date() >= lockoutTime;
    if (event.status === 'archived') {
      uploadStatus = 'archived';
    } else if (eventStarted) {
      uploadStatus = 'started';
    } else if (portalLocked) {
      uploadStatus = 'started'; // Reuse 'started' state - portal is locked for message preparation
    } else if (!event.guest_list_uploaded || total === 0) {
      uploadStatus = 'empty';
    } else {
      // Use a separate count query so the result isn't scoped to the current page
      const { count: sentCount } = await supabase
        .from('event_guest_phones')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('wa_pre_event_sent', true);
      uploadStatus = (sentCount ?? 0) > 0 ? 'sent' : 'uploaded';
    }

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        status: event.status,
        messagesEnabled: event.wa_messages_enabled,
      },
      guests: formattedGuests,
      total,
      page,
      totalPages,
      uploadStatus,
      isReadOnly,
      guestPhoneConsentAt: event.guest_phone_consent_at ?? null,
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

    // Check event is not archived, not in lockout window, and messaging enabled
    const { data: evPost } = await supabase
      .from('events')
      .select('id, status, starts_at, wa_messages_enabled')
      .eq('id', eventId)
      .maybeSingle();

    if (!evPost || evPost.status === 'archived') {
      return jsonError('האירוע הסתיים - לא ניתן לעדכן את הרשימה', 400);
    }

    if (!evPost.wa_messages_enabled) {
      return jsonError('שירות ההודעות אינו פעיל עבור אירוע זה - הפורטל לא זמין', 403);
    }

    const postLockout = evPost.starts_at
      ? new Date(new Date(evPost.starts_at).getTime() - PORTAL_LOCKOUT_HOURS_BEFORE * 60 * 60 * 1000)
      : null;
    if (postLockout && new Date() >= postLockout) {
      return jsonError('הפורטל ננעל להכנת שליחת ההודעות - לא ניתן לעדכן את הרשימה', 400);
    }

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return await handleFileUpload(req, supabase, eventId);
    }

    // JSON branch: either a consent acknowledgement or a single-phone add.
    const jsonBody = await req.json().catch(() => null);
    if (jsonBody && (jsonBody as { consent?: unknown }).consent === true) {
      return await handleGuestPhoneConsent(supabase, eventId);
    }
    return await handleSingleAdd(jsonBody, supabase, eventId);
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
    return jsonError('׳”׳§׳•׳‘׳¥ ׳-׳™׳™׳‘ ׳׳”׳™׳•׳× ׳‘׳₪׳•׳¨׳׳˜ Excel (.xlsx) ׳׳• CSV (.csv)', 400);
  }

  // Check current count
  const { count: currentCount } = await supabase
    .from('event_guest_phones')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if ((currentCount ?? 0) >= MAX_GUEST_PHONES_PER_EVENT) {
    return jsonError(
      `׳”׳’׳¢׳×׳ ׳׳׳§׳¡׳™׳׳•׳ ${MAX_GUEST_PHONES_PER_EVENT} ׳׳•׳¨׳-׳™׳`,
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

  // Enforce per-event cap: trim valid rows so total never exceeds the limit
  const remaining = MAX_GUEST_PHONES_PER_EVENT - (currentCount ?? 0);
  const trimmed = result.validGuests.length - Math.min(result.validGuests.length, remaining);
  if (remaining < result.validGuests.length) {
    result.validGuests = result.validGuests.slice(0, remaining);
  }

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

  // Insert valid rows (with encryption)
  if (result.validGuests.length > 0) {
    const rows = result.validGuests.map((g: { phone: string; guest_name: string | null }) => ({
      event_id: eventId,
      ...phoneWriteFields(g.phone),
      guest_name_enc: encryptPii(g.guest_name || null),
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
    ...(trimmed > 0 && { trimmedByLimit: trimmed }),
    errors: result.errors.slice(0, 20),
    totalInList: newCount ?? 0,
  });
}

async function handleGuestPhoneConsent(
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string
) {
  // Record the customer's authorization to provide guest phone numbers.
  // Idempotent: the timestamp is stamped once and not overwritten on repeat.
  const { data: ev } = await supabase
    .from('events')
    .select('guest_phone_consent_at')
    .eq('id', eventId)
    .maybeSingle();

  const consentAt = ev?.guest_phone_consent_at ?? new Date().toISOString();

  if (!ev?.guest_phone_consent_at) {
    const { error } = await supabase
      .from('events')
      .update({
        guest_phone_consent_at: consentAt,
        guest_phone_consent_version: GUEST_PHONE_CONSENT_VERSION,
      })
      .eq('id', eventId);

    if (error) {
      logger.error('[GUEST_PORTAL_CONSENT] update error:', error.message);
      return jsonError('Failed to record consent', 500);
    }
  }

  return NextResponse.json({ success: true, guestPhoneConsentAt: consentAt });
}

async function handleSingleAdd(
  body: unknown,
  supabase: ReturnType<typeof getServiceClient>,
  eventId: string
) {
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
      `׳”׳’׳¢׳×׳ ׳׳׳§׳¡׳™׳׳•׳ ${MAX_GUEST_PHONES_PER_EVENT} ׳׳•׳¨׳-׳™׳`,
      400
    );
  }

  // Check for duplicate (use blind index if encryption is active)
  const { column: phoneCol, value: phoneVal } = phoneLookupFilter(normalized);
  const { data: dup } = await supabase
    .from('event_guest_phones')
    .select('id')
    .eq('event_id', eventId)
    .eq(phoneCol, phoneVal)
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
      ...phoneWriteFields(normalized),
      guest_name: guestName,
      guest_name_enc: encryptPii(guestName),
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


    // Check event is not archived, not in lockout window, and messaging enabled
    const { data: evDel } = await supabase
      .from('events')
      .select('id, status, starts_at, wa_messages_enabled')
      .eq('id', eventId)
      .maybeSingle();

    if (!evDel || evDel.status === 'archived') {
      return jsonError('האירוע הסתיים - לא ניתן לעדכן את הרשימה', 400);
    }

    if (!evDel.wa_messages_enabled) {
      return jsonError('שירות ההודעות אינו פעיל עבור אירוע זה - הפורטל לא זמין', 403);
    }

    const delLockout = evDel.starts_at
      ? new Date(new Date(evDel.starts_at).getTime() - PORTAL_LOCKOUT_HOURS_BEFORE * 60 * 60 * 1000)
      : null;
    if (delLockout && new Date() >= delLockout) {
      return jsonError('הפורטל ננעל להכנת שליחת ההודעות - לא ניתן לעדכן את הרשימה', 400);
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
        '׳׳ ׳ ׳™׳×׳ ׳׳”׳¡׳™׳¨ ׳׳¡׳₪׳¨ ׳©׳›׳‘׳¨ ׳ ׳©׳׳-׳” ׳׳׳™׳• ׳”׳•׳“׳¢׳”',
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
