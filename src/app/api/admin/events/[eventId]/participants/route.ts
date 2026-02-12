import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';

/**
 * GET /api/admin/events/[eventId]/participants
 * Returns all participants for an event, newest first.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-participants-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('participants')
      .select('id, display_name, gender, age, is_banned, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ participants: data || [] });
  } catch (err) {
    console.error('[ADMIN_PARTICIPANTS_GET] error:', err);
    return jsonError('Failed to load participants', 500);
  }
}

/**
 * PATCH /api/admin/events/[eventId]/participants
 * Ban or unban a participant. Also syncs the banned_devices table
 * based on the participant's device fingerprint.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-participants-patch', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const { eventId } = await params;
    const { participantId, is_banned } = await req.json();

    if (!participantId || is_banned === undefined) {
      return jsonError('Missing fields', 400);
    }
    if (typeof is_banned !== 'boolean') {
      return jsonError('Invalid is_banned value', 400);
    }
    if (!isValidUUID(eventId) || !isValidUUID(participantId)) {
      return jsonError('Invalid ID format', 400);
    }

    const supabase = getServiceClient();

    // Update participant ban status
    const { error } = await supabase
      .from('participants')
      .update({ is_banned })
      .eq('id', participantId)
      .eq('event_id', eventId);

    if (error) return jsonError('Failed to update participant', 400);

    adminAuditLog(is_banned ? 'PARTICIPANT_BAN' : 'PARTICIPANT_UNBAN', { eventId, participantId }, req);

    // Sync banned_devices table (single lookup instead of duplicate blocks)
    const { data: participant } = await supabase
      .from('participants')
      .select('device_fingerprint')
      .eq('id', participantId)
      .single();

    if (participant?.device_fingerprint) {
      if (is_banned) {
        await supabase
          .from('banned_devices')
          .upsert(
            { event_id: eventId, device_fingerprint: participant.device_fingerprint },
            { onConflict: 'event_id,device_fingerprint', ignoreDuplicates: true }
          );
      } else {
        await supabase
          .from('banned_devices')
          .delete()
          .eq('event_id', eventId)
          .eq('device_fingerprint', participant.device_fingerprint);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ADMIN_PARTICIPANTS_PATCH] error:', err);
    return jsonError('Server error', 500);
  }
}
