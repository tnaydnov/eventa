import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { MAX_BACKGROUND_SIZE_BYTES } from '@/lib/constants';
import { jsonError } from '@/lib/route-helpers';
import { validateImageMagicBytes } from '@/lib/validations';
import { adminGuard, validateEventId } from '../../../_helpers';
import { logger } from '@/lib/logger';

/** Allowed MIME types → safe file extensions for background images. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const ALLOWED_TYPES = Object.keys(MIME_TO_EXT);

/**
 * POST /api/admin/events/[eventId]/background
 * Upload a background image for an event.
 * Accepts multipart/form-data with a single "file" field.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-bg-upload', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return jsonError('No file provided', 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonError('Only JPEG, PNG, or WebP images are allowed', 400);
    }
    if (file.size > MAX_BACKGROUND_SIZE_BYTES) {
      return jsonError('File too large (max 5MB)', 400);
    }

    const supabase = getServiceClient();
    const ext = MIME_TO_EXT[file.type] || 'jpg';
    const storagePath = `${eventId}/bg.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes match claimed MIME type (prevents spoofed Content-Type)
    if (!validateImageMagicBytes(new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.length, 16)), file.type)) {
      return jsonError('File content does not match declared type', 400);
    }

    // Remove old backgrounds with different extensions (prevents orphaned files
    // when switching e.g. from JPG to PNG)
    const staleExtensions = Object.values(MIME_TO_EXT).filter(e => e !== ext);
    if (staleExtensions.length > 0) {
      const { error: staleErr } = await supabase.storage.from('backgrounds').remove(
        staleExtensions.map(e => `${eventId}/bg.${e}`)
      );
      if (staleErr) logger.error('[BACKGROUND_UPLOAD] stale cleanup error:', staleErr.message);
    }

    // Upload (upsert) to storage
    const { error: uploadError } = await supabase.storage
      .from('backgrounds')
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      logger.error('[BACKGROUND_UPLOAD] Storage error:', uploadError.message);
      return jsonError('Upload failed', 500);
    }

    // Get public URL with cache-busting timestamp (same path → same URL, so
    // browsers/CDN would serve the stale cached image without this).
    const { data: urlData } = supabase.storage.from('backgrounds').getPublicUrl(storagePath);
    const publicUrlWithCacheBust = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('events')
      .update({ background_image: publicUrlWithCacheBust })
      .eq('id', eventId);

    if (updateError) {
      logger.error('[BACKGROUND_UPLOAD] DB error:', updateError.message);
      return jsonError('Failed to update event', 500);
    }

    adminAuditLog('BACKGROUND_UPLOAD', { eventId }, req);
    return NextResponse.json({ background_image: publicUrlWithCacheBust });
  } catch (err) {
    logger.error('[BACKGROUND_UPLOAD] error:', err);
    return jsonError('Upload failed', 500);
  }
}

/**
 * DELETE /api/admin/events/[eventId]/background
 * Remove the background image. Clears all possible extensions from storage (best-effort).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-bg-delete', RATE_LIMITS.strict);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    // Remove all possible extensions from storage (best-effort)
    const { error: removeErr } = await supabase.storage.from('backgrounds').remove(
      Object.values(MIME_TO_EXT).map(ext => `${eventId}/bg.${ext}`)
    );
    if (removeErr) logger.error('[BACKGROUND_DELETE] storage remove error:', removeErr.message);

    // Clear the DB field
    const { error } = await supabase
      .from('events')
      .update({ background_image: null })
      .eq('id', eventId);

    if (error) {
      logger.error('[BACKGROUND_DELETE] DB error:', error.message);
      return jsonError('Failed to remove background', 500);
    }

    adminAuditLog('BACKGROUND_REMOVE', { eventId }, req);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[BACKGROUND_DELETE] error:', err);
    return jsonError('Failed to remove background', 500);
  }
}
