import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { clearSessionCookieHeader } from '@/lib/session';
import { STORAGE_BATCH_SIZE } from '@/lib/constants';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated participant and all their associated data.
 */
export async function POST(req: NextRequest) {
  logger.info('[ACCOUNT_DELETE] request received');
  const guard = await secureGuard(req, 'account-delete', RATE_LIMITS.strict);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const participantId = session.sub;
    const eventId = session.eid;

    const supabase = getServiceClient();

    // Pre-check: verify participant exists before starting cascade
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (participantError || !participant) {
      return jsonError('Participant not found', 404);
    }

    // 1. Delete photos from storage (scoped to event)
    const { data: photos } = await supabase
      .from('participant_photos')
      .select('storage_path')
      .eq('participant_id', participantId)
      .eq('event_id', eventId);

    if (photos && photos.length > 0) {
      await supabase.storage
        .from('photos')
        .remove(photos.map((p) => p.storage_path));
    }

    // 2. Delete photo records (PII - remove from DB too)
    await supabase
      .from('participant_photos')
      .delete()
      .eq('participant_id', participantId)
      .eq('event_id', eventId);

    // 3. Delete notifications (ephemeral UI - no analytics value)
    await supabase
      .from('notifications')
      .delete()
      .eq('event_id', eventId)
      .eq('to_participant_id', participantId);

    // NOTE: likes, blocks, conversations, messages and activity_log are
    // intentionally KEPT so the participant still counts in event analytics.

    // 4. Remove device from banned_devices so the user can rejoin freely.
    //    Self-deletion is NOT an admin ban - the user should get a clean slate.
    const { data: selfParticipant } = await supabase
      .from('participants')
      .select('device_fingerprint, hardware_fingerprint')
      .eq('id', participantId)
      .maybeSingle();

    if (selfParticipant) {
      const fps = [
        selfParticipant.device_fingerprint,
        selfParticipant.hardware_fingerprint,
      ].filter(Boolean) as string[];

      for (const fp of fps) {
        await supabase
          .from('banned_devices')
          .delete()
          .eq('event_id', eventId)
          .eq('device_fingerprint', fp);
      }
    }

    // 5. Soft-delete: anonymise PII and mark as deleted.
    //    Analytics fields (gender, attracted_to, age) are preserved.
    const { error: softDelErr } = await supabase
      .from('participants')
      .update({
        deleted_at: new Date().toISOString(),
        display_name: '[מחוק]',
        bio: null,
        city: null,
        looking_for: null,
        phone: null,
        device_fingerprint: null,
        hardware_fingerprint: null,
      })
      .eq('id', participantId);

    if (softDelErr) {
      logger.error('[ACCOUNT_DELETE] soft-delete error:', softDelErr.message);
      return jsonError('Failed to delete account', 500);
    }

    logger.info('[ACCOUNT_DELETE] soft-delete success:', JSON.stringify({ participantId, eventId, ts: new Date().toISOString() }));

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (err) {
    logger.error('[ACCOUNT_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
