import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';

/** Allowed MIME types for QR page attachments. */
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

/**
 * POST /api/admin/events/[eventId]/qr-upload-url
 *
 * Returns a signed upload URL so the admin client can upload a QR page file
 * directly to Supabase Storage (bypassing Vercel's 4.5 MB body limit).
 *
 * Body (JSON): { filename: string, contentType: string }
 * Returns:     { signedUrl: string, token: string, storagePath: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = await adminGuard(req, 'admin-qr-upload-url', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const { filename, contentType } = await req.json();

    if (!filename || typeof filename !== 'string') {
      return jsonError('Missing filename', 400);
    }
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return jsonError(
        `סוג קובץ לא נתמך (${contentType}). רק PDF, PNG, JPG, WebP.`,
        400
      );
    }

    // Sanitise filename: keep only safe chars
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const uid = crypto.randomUUID();
    const storagePath = `qr-temp/${eventId}/${uid}-${safeName}`;

    const supabase = getServiceClient();
    const { data, error } = await supabase.storage
      .from('backgrounds')
      .createSignedUploadUrl(storagePath);

    if (error) {
      logger.error('[QR_UPLOAD_URL] createSignedUploadUrl error:', error.message);
      return jsonError('Failed to create upload URL', 500);
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (err) {
    logger.error('[QR_UPLOAD_URL] error:', err);
    return jsonError('Server error', 500);
  }
}
