import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { MAX_PHOTOS } from '@/lib/constants';
import { secureGuard, jsonError, isSafePath } from '@/lib/route-helpers';

/**
 * POST /api/secure/photos
 * Create a photo DB record (after client-side storage upload).
 * Validates ownership of storage path and enforces MAX_PHOTOS limit.
 */
export async function POST(req: NextRequest) {
  const guard = secureGuard(req, 'photos-post', RATE_LIMITS.upload);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { storagePath, orderIndex } = await req.json();
    if (!storagePath || orderIndex === undefined) {
      return jsonError('Missing fields', 400);
    }

    // Validate storagePath belongs to this participant
    if (typeof storagePath !== 'string' || !isSafePath(storagePath) || !storagePath.startsWith(`${session.eid}/`) || !storagePath.includes(session.sub)) {
      return jsonError('Invalid storage path', 400);
    }

    // Validate orderIndex is a non-negative integer
    const idx = Number(orderIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > MAX_PHOTOS) {
      return jsonError('Invalid order index', 400);
    }

    const supabase = getServiceClient();

    // Enforce photo count limit
    const { count } = await supabase
      .from('participant_photos')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', session.sub)
      .eq('event_id', session.eid);

    if ((count ?? 0) >= MAX_PHOTOS) {
      return jsonError(`Maximum ${MAX_PHOTOS} photos allowed`, 400);
    }

    const { data, error } = await supabase
      .from('participant_photos')
      .insert({
        event_id: session.eid,
        participant_id: session.sub,
        storage_path: storagePath,
        order_index: idx,
      })
      .select()
      .single();

    if (error) {
      console.error('[PHOTOS_POST] insert error:', error);
      return jsonError('Failed to save photo', 400);
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[PHOTOS_POST] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * DELETE /api/secure/photos
 * Delete a photo (storage + DB record). Verifies ownership.
 */
export async function DELETE(req: NextRequest) {
  const guard = secureGuard(req, 'photos-del', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { photoId } = await req.json();
    if (!photoId || !isValidUUID(photoId)) {
      return jsonError('Invalid photo', 400);
    }

    const supabase = getServiceClient();

    // Verify ownership
    const { data: photo } = await supabase
      .from('participant_photos')
      .select('participant_id, storage_path')
      .eq('id', photoId)
      .single();

    if (!photo || photo.participant_id !== session.sub) {
      return jsonError('Forbidden', 403);
    }

    // Always use DB-stored path — never trust client-supplied storagePath
    if (photo.storage_path) {
      await supabase.storage.from('photos').remove([photo.storage_path]);
    }
    await supabase.from('participant_photos').delete().eq('id', photoId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PHOTOS_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * PATCH /api/secure/photos
 * Reorder photos — update order_index for each photo.
 * Body: { order: [{ id: string, order_index: number }] }
 */
export async function PATCH(req: NextRequest) {
  const guard = secureGuard(req, 'photos-reorder', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { order } = await req.json();
    if (!Array.isArray(order) || order.length === 0 || order.length > MAX_PHOTOS) {
      return jsonError('Invalid order array', 400);
    }

    // Validate all IDs are valid UUIDs and order_index values are valid
    const ids = order.map((o: { id: string; order_index: number }) => o.id);
    if (ids.some((id: string) => !isValidUUID(id))) {
      return jsonError('Invalid photo id', 400);
    }
    if (order.some((o: { order_index: number }) => !Number.isInteger(o.order_index) || o.order_index < 0)) {
      return jsonError('Invalid order_index', 400);
    }

    const supabase = getServiceClient();

    // Verify all photos belong to this participant
    const { data: photos } = await supabase
      .from('participant_photos')
      .select('id, participant_id')
      .in('id', ids);

    if (!photos || photos.length !== ids.length) {
      return jsonError('Invalid photo ids', 400);
    }

    const allOwned = photos.every((p) => p.participant_id === session.sub);
    if (!allOwned) {
      return jsonError('Forbidden', 403);
    }

    // Update all order_index values in parallel
    await Promise.all(
      order.map((item: { id: string; order_index: number }) =>
        supabase
          .from('participant_photos')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PHOTOS_REORDER] error:', err);
    return jsonError('Server error', 500);
  }
}
