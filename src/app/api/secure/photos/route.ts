import { NextRequest, NextResponse, after } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { MAX_PHOTOS } from '@/lib/constants';
import { secureGuard, jsonError, isSafePath } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';
import { photoReorderSchema } from '@/lib/validations';
import { preModerationCheck, moderateProfilePhoto } from '@/lib/moderation';

/**
 * POST /api/secure/photos
 * Create a photo DB record (after client-side storage upload).
 * Validates ownership of storage path and enforces MAX_PHOTOS limit.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'photos-post', RATE_LIMITS.upload);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { storagePath, orderIndex } = await req.json();
    if (!storagePath || orderIndex === undefined) {
      return jsonError('Missing fields', 400);
    }

    // Validate storagePath belongs to this participant
    if (typeof storagePath !== 'string' || !isSafePath(storagePath) || !storagePath.startsWith(`${session.eid}/`) || !storagePath.startsWith(`${session.eid}/${session.sub}/`)) {
      return jsonError('Invalid storage path', 400);
    }

    // Validate orderIndex is a non-negative integer
    const idx = Number(orderIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_PHOTOS) {
      return jsonError('Invalid order index', 400);
    }

    const supabase = getServiceClient();

    // Idempotency-by-storage_path: retries should return the same photo row.
    const { data: existingPhoto, error: existingPhotoError } = await supabase
      .from('participant_photos')
      .select('*')
      .eq('event_id', session.eid)
      .eq('participant_id', session.sub)
      .eq('storage_path', storagePath)
      .maybeSingle();

    if (existingPhotoError) {
      logger.error('[PHOTOS_POST] existing photo lookup failed', { error: existingPhotoError.message });
      return jsonError('Server error', 500);
    }

    if (existingPhoto) {
      return NextResponse.json(existingPhoto);
    }

    // Enforce photo count limit
    const { count, error: countErr } = await supabase
      .from('participant_photos')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', session.sub)
      .eq('event_id', session.eid);

    if (countErr) {
      logger.error('[PHOTOS] count query failed', { error: countErr.message });
      return jsonError('Server error', 500);
    }

    if ((count ?? 0) >= MAX_PHOTOS) {
      return jsonError(`Maximum ${MAX_PHOTOS} photos allowed`, 400);
    }

    // Moderate synchronously BEFORE inserting to DB.
    // Uses a signed URL so the file is accessible immediately (no CDN propagation delay).
    const preCheck = await preModerationCheck(storagePath);
    if (preCheck.blocked) {
      // Delete from storage so nothing is left behind
      void getServiceClient().storage.from('photos').remove([storagePath]);
      return jsonError('התמונה לא עומדת בהנחיות הקהילה. אנא בחרו תמונה מתאימה.', 422);
    }

    const { data, error } = await supabase
      .from('participant_photos')
      .insert({
        event_id: session.eid,
        participant_id: session.sub,
        storage_path: storagePath,
        order_index: idx,
        moderation_status: 'approved',
      })
      .select()
      .single();

    if (error) {
      logger.error('[PHOTOS_POST] insert error:', error);
      return jsonError('Failed to save photo', 400);
    }

    // Run audit logging in after() - moderation decision is already final from preModerationCheck
    after(() => moderateProfilePhoto(data.id as string, storagePath, session.sub, session.eid));

    return NextResponse.json(data);
  } catch (err) {
    logger.error('[PHOTOS_POST] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * DELETE /api/secure/photos
 * Delete a photo (storage + DB record). Verifies ownership.
 */
export async function DELETE(req: NextRequest) {
  const guard = await secureGuard(req, 'photos-del', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { photoId } = await req.json();
    if (!photoId || !isValidUUID(photoId)) {
      return jsonError('Invalid photo', 400);
    }

    const supabase = getServiceClient();

    // Verify ownership + event scoping
    const { data: photo, error: photoError } = await supabase
      .from('participant_photos')
      .select('participant_id, storage_path')
      .eq('id', photoId)
      .eq('event_id', session.eid)
      .maybeSingle();

    if (photoError) {
      logger.error('[PHOTOS_DELETE] photo lookup failed:', photoError);
      return jsonError('Server error', 500);
    }

    if (!photo || photo.participant_id !== session.sub) {
      return jsonError('Forbidden', 403);
    }

    // Storage removal + DB delete in parallel
    const [storageResult, dbResult] = await Promise.all([
      photo.storage_path
        ? supabase.storage.from('photos').remove([photo.storage_path])
        : Promise.resolve(null),
      supabase.from('participant_photos').delete().eq('id', photoId),
    ]);

    if (storageResult && 'error' in storageResult && storageResult.error) {
      logger.error('[PHOTOS_DELETE] storage remove error:', storageResult.error);
    }
    if (dbResult.error) {
      logger.error('[PHOTOS_DELETE] DB delete error:', dbResult.error.message);
      return jsonError('Failed to delete photo', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[PHOTOS_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * PATCH /api/secure/photos
 * Reorder photos - update order_index for each photo.
 * Body: { order: [{ id: string, order_index: number }] }
 */
export async function PATCH(req: NextRequest) {
  const guard = await secureGuard(req, 'photos-reorder', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const raw = await req.json();
    const parsed = photoReorderSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError('Invalid order data', 400);
    }
    const { order } = parsed.data;
    const ids = order.map((o) => o.id);

    const supabase = getServiceClient();

    // Verify all photos belong to this participant in this event
    const { data: photos, error: photosError } = await supabase
      .from('participant_photos')
      .select('id, participant_id')
      .in('id', ids)
      .eq('event_id', session.eid);

    if (photosError) {
      logger.error('[PHOTOS_REORDER] photos lookup failed:', photosError);
      return jsonError('Server error', 500);
    }

    if (!photos || photos.length !== ids.length) {
      return jsonError('Invalid photo ids', 400);
    }

    const allOwned = photos.every((p) => p.participant_id === session.sub);
    if (!allOwned) {
      return jsonError('Forbidden', 403);
    }

    // Update all order_index values in parallel
    const reorderResults = await Promise.all(
      order.map((item) =>
        supabase
          .from('participant_photos')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
      )
    );

    const reorderErrors = reorderResults.filter((r) => r.error);
    if (reorderErrors.length > 0) {
      logger.error('[PHOTOS_REORDER] update errors:', reorderErrors.map((r) => r.error?.message).join('; '));
      return jsonError('Failed to reorder some photos', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[PHOTOS_REORDER] error:', err);
    return jsonError('Server error', 500);
  }
}
