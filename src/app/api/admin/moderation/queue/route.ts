import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { adminGuard, jsonError } from '../../_helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/moderation/queue
 * Returns pending moderation items with joined photo/message data.
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-moderation-queue', RATE_LIMITS.standard);
  if (denied) return denied;

  const supabase = getServiceClient();

  const { data: items, error } = await supabase
    .from('moderation_review_queue')
    .select(`
      id,
      event_id,
      item_type,
      photo_id,
      message_id,
      score,
      label,
      status,
      created_at,
      participant_photos!photo_id(storage_path, participant_id, participants!participant_id(display_name)),
      messages!message_id(text, sender_participant_id)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    logger.error('[ADMIN_MODERATION_QUEUE] fetch error:', error.message);
    return jsonError('Server error', 500);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  const enriched = (items ?? []).map((item) => {
    const photoData = item.participant_photos as unknown as Record<string, unknown> | null;
    const msgData = item.messages as unknown as Record<string, unknown> | null;
    const participant = photoData?.['participants'] as Record<string, unknown> | null;

    return {
      id: item.id,
      event_id: item.event_id,
      item_type: item.item_type,
      photo_id: item.photo_id,
      message_id: item.message_id,
      score: item.score,
      label: item.label,
      status: item.status,
      created_at: item.created_at,
      photo_url: photoData?.['storage_path']
        ? `${supabaseUrl}/storage/v1/object/public/photos/${photoData['storage_path']}`
        : undefined,
      participant_name: participant?.['display_name'] ?? undefined,
      message_text: msgData?.['text'] ?? undefined,
    };
  });

  return NextResponse.json({ items: enriched });
}
