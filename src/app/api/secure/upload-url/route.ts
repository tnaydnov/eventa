import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { secureGuard, jsonError, isSafePath } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/** Allowed file extensions for uploads. HEIC/HEIF excluded — iOS converts to JPEG when sharing to web. */
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp3', 'ogg', 'wav', 'mp4', 'm4a', 'webm']);

/**
 * POST /api/secure/upload-url
 * Generate a signed upload URL for Supabase Storage.
 * Client uploads the file directly to the signed URL - no anon key needed.
 *
 * Validated paths:
 *   - Profile photo: {eventId}/{participantId}/...
 *   - Chat media:    chat/{eventId}/{conversationId}/...
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'upload', RATE_LIMITS.upload);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { path } = await req.json();
    if (!path || typeof path !== 'string') {
      return jsonError('Missing path', 400);
    }

    // Reject path traversal
    if (!isSafePath(path)) {
      return jsonError('Invalid path', 400);
    }

    // Validate file extension
    const ext = path.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return jsonError('Invalid file type', 400);
    }

    // Validate the path is scoped to this participant or their event's chat
    const isProfilePhoto = path.startsWith(`${session.eid}/${session.sub}/`);
    // Chat media must include conversation ID - verified via query below
    const chatPrefix = `chat/${session.eid}/`;
    const isChatMedia = path.startsWith(chatPrefix);
    if (!isProfilePhoto && !isChatMedia) {
      return jsonError('Invalid upload path', 403);
    }

    const supabase = getServiceClient();

    // For chat media, verify the user is a member of the referenced conversation
    if (isChatMedia) {
      const conversationId = path.slice(chatPrefix.length).split('/')[0];
      if (!conversationId) {
        return jsonError('Invalid chat media path', 403);
      }
      const { data: conv } = await supabase
        .from('conversations')
        .select('a_participant_id, b_participant_id')
        .eq('id', conversationId)
        .eq('event_id', session.eid)
        .maybeSingle();

      if (!conv || (conv.a_participant_id !== session.sub && conv.b_participant_id !== session.sub)) {
        return jsonError('Invalid upload path', 403);
      }
    }

    const { data, error } = await supabase.storage
      .from('photos')
      .createSignedUploadUrl(path);

    if (error) {
      logger.error('[UPLOAD_URL] createSignedUploadUrl error:', error.message);
      return jsonError('Failed to create upload URL', 400);
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    });
  } catch (err) {
    logger.error('[UPLOAD_URL] error:', err);
    return jsonError('Server error', 500);
  }
}
