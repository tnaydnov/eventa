import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

const SIGNED_URL_EXPIRY_S = 3600; // 1 hour
const MAX_PATHS_PER_REQUEST = 100;

/**
 * POST /api/secure/photo-urls
 * Generate Supabase Storage signed read URLs for a batch of storage paths.
 *
 * Security:
 *  - Requires valid session cookie (secureGuard)
 *  - Each requested path MUST start with the session's event_id — prevents
 *    cross-event photo access even if an attacker sends arbitrary paths
 *  - Returns a map { storagePath: signedUrl }
 *
 * Usage: client-side signed-photo-cache.ts calls this endpoint to prefetch
 * signed URLs for all participant photos before rendering. When the Supabase
 * "photos" bucket is set to PRIVATE, only these signed URLs will work.
 * While the bucket is still public, this endpoint runs silently as a no-op
 * from the UI perspective — the cache is populated and getPhotoUrl() will
 * prefer signed URLs when available.
 *
 * Request body: { paths: string[] }
 * Response:     { [storagePath]: signedUrl }
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'photo-urls', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { paths } = await req.json() as { paths: unknown };

    if (!Array.isArray(paths)) {
      return jsonError('paths must be an array', 400);
    }

    // Sanitize: keep only non-empty strings, up to the limit
    const rawPaths = (paths as unknown[])
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .slice(0, MAX_PATHS_PER_REQUEST);

    if (rawPaths.length === 0) {
      return NextResponse.json({});
    }

    // Security: every path must start with the session's event_id.
    // This ensures participants can only fetch signed URLs for photos in their own event.
    const eventPrefix = `${session.eid}/`;
    const chatPrefix = `chat/${session.eid}/`;
    const validPaths = rawPaths.filter(
      (p) => p.startsWith(eventPrefix) || p.startsWith(chatPrefix)
    );

    if (validPaths.length === 0) {
      return NextResponse.json({});
    }

    const supabase = getServiceClient();

    // Batch create signed URLs (one Supabase call with multiple paths)
    const { data, error } = await supabase.storage
      .from('photos')
      .createSignedUrls(validPaths, SIGNED_URL_EXPIRY_S);

    if (error) {
      logger.error('[PHOTO_URLS] createSignedUrls error:', error.message);
      return jsonError('Failed to create signed URLs', 500);
    }

    // Build response map: storagePath → signedUrl
    const result: Record<string, string> = {};
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        result[item.path] = item.signedUrl;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[PHOTO_URLS] error:', err);
    return jsonError('Server error', 500);
  }
}
