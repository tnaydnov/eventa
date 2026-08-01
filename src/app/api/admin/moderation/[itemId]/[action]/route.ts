import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { adminGuard, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { isValidUUID } from '@/lib/session';

type RouteParams = { params: Promise<{ itemId: string; action: string }> };

/**
 * POST /api/admin/moderation/[itemId]/[action]
 * Action: "approve" | "reject"
 * Updates the queue item status and applies result to source photo/message.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const denied = await adminGuard(req, 'admin-moderation-action', RATE_LIMITS.standard);
  if (denied) return denied;

  const { itemId, action } = await params;
  if (!isValidUUID(itemId)) return jsonError('Invalid item ID', 400);
  if (action !== 'approve' && action !== 'reject') return jsonError('Invalid action', 400);

  const supabase = getServiceClient();

  // Get the queue item
  const { data: item, error: fetchError } = await supabase
    .from('moderation_review_queue')
    .select('id, item_type, photo_id, message_id, status')
    .eq('id', itemId)
    .maybeSingle();

  if (fetchError) {
    logger.error('[ADMIN_MODERATION_ACTION] fetch error:', fetchError.message);
    return jsonError('Server error', 500);
  }

  if (!item) return jsonError('Not found', 404);
  if (item.status !== 'pending') return jsonError('Already reviewed', 409);

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  // Update queue item
  const { error: updateQueueError } = await supabase
    .from('moderation_review_queue')
    .update({ status: newStatus, reviewed_at: now })
    .eq('id', itemId);

  if (updateQueueError) {
    logger.error('[ADMIN_MODERATION_ACTION] queue update error:', updateQueueError.message);
    return jsonError('Server error', 500);
  }

  // Apply result to source record
  if (item.item_type === 'photo' && item.photo_id) {
    await supabase
      .from('participant_photos')
      .update({ moderation_status: newStatus, moderation_reviewed_at: now })
      .eq('id', item.photo_id);
  } else if (item.item_type === 'message' && item.message_id) {
    if (newStatus === 'rejected') {
      // Soft-delete the message
      await supabase
        .from('messages')
        .update({ is_deleted: true, text: null, media_path: null })
        .eq('id', item.message_id);
    }
  }

  logger.info(`[ADMIN_MODERATION_ACTION] item=${itemId} action=${action}`);
  return NextResponse.json({ success: true });
}
