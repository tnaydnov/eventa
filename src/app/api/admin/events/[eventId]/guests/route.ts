import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { guestPhoneImportSchema } from '@/lib/validations';
import { normalizePhone, isValidIsraeliMobile, maskPhone } from '@/lib/messaging/phone-utils';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { MAX_GUEST_NAME_LENGTH, MAX_GUEST_PHONES_PER_EVENT } from '@/lib/config';
import {
  processGuestUpload,
  MAX_UPLOAD_FILE_SIZE,
  isAllowedUploadFile,
} from '@/lib/guest-upload';

// ─── Column selection ───────────────────────────────────

const GUEST_PHONE_COLUMNS =
  'id, event_id, phone, guest_name, wa_pre_event_sent, wa_pre_event_sent_at, created_at' as const;

/**
 * GET /api/admin/events/[eventId]/guests
 * List all guest phone entries for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-guests-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('event_guest_phones')
      .select(GUEST_PHONE_COLUMNS)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[ADMIN_GUESTS_GET] query error:', error.message);
      return jsonError('Failed to load guest list', 500);
    }

    return NextResponse.json({
      guests: data || [],
      total: data?.length ?? 0,
    });
  } catch (err) {
    logger.error('[ADMIN_GUESTS_GET] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * POST /api/admin/events/[eventId]/guests
 * Import guest phones — supports JSON body or multipart file upload.
 *
 * JSON body: { guests: [{ phone, name? }] }
 * Multipart: file field with .xlsx or .csv
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-guests-post', RATE_LIMITS.strict, {
    maxBodyBytes: MAX_UPLOAD_FILE_SIZE + 1024, // file + form overhead
  });
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const supabase = getServiceClient();

    // Verify event exists and has WA messaging enabled
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, wa_messages_enabled')
      .eq('id', eventId)
      .single();

    if (evErr || !event) return jsonError('Event not found', 404);

    // Load existing phones for duplicate detection
    const { data: existing } = await supabase
      .from('event_guest_phones')
      .select('phone')
      .eq('event_id', eventId);

    const existingPhones = new Set((existing || []).map((r: { phone: string }) => r.phone));

    // Check total limit
    if (existingPhones.size >= MAX_GUEST_PHONES_PER_EVENT) {
      return jsonError(`מקסימום ${MAX_GUEST_PHONES_PER_EVENT} מספרים לאירוע`, 400);
    }

    const contentType = req.headers.get('content-type') || '';

    // ─── Multipart file upload ──────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return jsonError('No file provided', 400);
      }

      if (file.size > MAX_UPLOAD_FILE_SIZE) {
        return jsonError('הקובץ גדול מדי — עד 5MB', 400);
      }

      if (!isAllowedUploadFile(file.name)) {
        return jsonError('הקובץ חייב להיות בפורמט Excel (.xlsx) או CSV (.csv)', 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await processGuestUpload(buffer, file.name, existingPhones);

      if (result.parseError) {
        return jsonError(result.parseError, 400);
      }

      // Insert valid guests
      if (result.validGuests.length > 0) {
        const rows = result.validGuests.map((g) => ({
          event_id: eventId,
          phone: g.phone,
          guest_name: g.guest_name,
        }));

        const { error: insertErr } = await supabase
          .from('event_guest_phones')
          .insert(rows);

        if (insertErr) {
          logger.error('[ADMIN_GUESTS_POST] insert error:', insertErr.message);
          return jsonError('Failed to save guest list', 500);
        }

        // Update event guest list status
        await updateGuestListStatus(supabase, eventId);
      }

      adminAuditLog('GUEST_LIST_UPLOAD', {
        eventId,
        added: result.added,
        duplicates: result.duplicates,
        invalid: result.invalid,
        source: 'admin_file',
      }, req);

      return NextResponse.json({
        added: result.added,
        duplicates: result.duplicates,
        invalid: result.invalid,
        errors: result.errors,
      });
    }

    // ─── JSON body (structured guest list) ──────────────
    const body = await req.json();
    const parsed = guestPhoneImportSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid input', 400);
    }

    const validGuests: { phone: string; guest_name: string | null }[] = [];
    let duplicates = 0;
    let invalidCount = 0;
    const batchPhones = new Set<string>();
    const errors: Array<{ phone: string; reason: string }> = [];

    for (const guest of parsed.data.guests) {
      const normalized = normalizePhone(guest.phone);
      if (!normalized || !isValidIsraeliMobile(guest.phone)) {
        invalidCount++;
        errors.push({
          phone: guest.phone,
          reason: `"${guest.phone}" — מספר לא תקין`,
        });
        continue;
      }
      if (existingPhones.has(normalized) || batchPhones.has(normalized)) {
        duplicates++;
        continue;
      }
      batchPhones.add(normalized);
      validGuests.push({
        phone: normalized,
        guest_name: guest.name
          ? sanitizeWithLimit(guest.name, MAX_GUEST_NAME_LENGTH)
          : null,
      });
    }

    if (validGuests.length > 0) {
      const rows = validGuests.map((g) => ({
        event_id: eventId,
        ...g,
      }));

      const { error: insertErr } = await supabase
        .from('event_guest_phones')
        .insert(rows);

      if (insertErr) {
        logger.error('[ADMIN_GUESTS_POST] insert error:', insertErr.message);
        return jsonError('Failed to save guest list', 500);
      }

      await updateGuestListStatus(supabase, eventId);
    }

    adminAuditLog('GUEST_LIST_IMPORT', {
      eventId,
      added: validGuests.length,
      duplicates,
      invalid: invalidCount,
      source: 'admin_json',
    }, req);

    return NextResponse.json({
      added: validGuests.length,
      duplicates,
      invalid: invalidCount,
      errors,
    });
  } catch (err) {
    logger.error('[ADMIN_GUESTS_POST] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * DELETE /api/admin/events/[eventId]/guests
 * Remove guest phone(s) from the list.
 * Body: { phones: string[] } (normalized E.164) or { phoneIds: string[] } (UUIDs)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-guests-delete', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const body = await req.json();
    const supabase = getServiceClient();

    // Support deletion by phone IDs
    const phoneIds: string[] = body.phoneIds || [];

    if (phoneIds.length === 0) {
      return jsonError('No phone IDs provided', 400);
    }

    if (phoneIds.length > 100) {
      return jsonError('Maximum 100 deletions at once', 400);
    }

    const { data: deleted, error } = await supabase
      .from('event_guest_phones')
      .delete()
      .eq('event_id', eventId)
      .in('id', phoneIds)
      .select('id');

    if (error) {
      logger.error('[ADMIN_GUESTS_DELETE] error:', error.message);
      return jsonError('Failed to remove guests', 500);
    }

    // Update event guest list count
    await updateGuestListStatus(supabase, eventId);

    adminAuditLog('GUEST_LIST_REMOVE', {
      eventId,
      removed: deleted?.length ?? 0,
    }, req);

    return NextResponse.json({
      removed: deleted?.length ?? 0,
    });
  } catch (err) {
    logger.error('[ADMIN_GUESTS_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}

// ─── Helpers ────────────────────────────────────────────

/**
 * Update the guest_list_uploaded/count fields on the event.
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
