import { NextRequest, NextResponse } from 'next/server';
import { adminAuditLog } from '@/lib/admin-auth';
import { isValidUUID } from '@/lib/session';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { evictBanCache, bumpSessionEpoch } from '@/lib/route-helpers';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';
import { readPhone, computeBlindIndex } from '@/lib/pii';

/**
 * GET /api/admin/events/[eventId]/participants
 * Returns all participants for an event, newest first.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = await adminGuard(req, 'admin-participants-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    // Fetch participants + guest phone list in parallel
    const [participantsRes, guestPhonesRes] = await Promise.all([
      supabase
        .from('participants')
        .select('id, display_name, gender, age, is_banned, deleted_at, created_at, phone_enc, phone_bi, sms_consent, feedback_sent')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('event_guest_phones')
        .select('phone_bi')
        .eq('event_id', eventId),
    ]);

    if (participantsRes.error) {
      logger.error('[ADMIN_PARTICIPANTS_GET] query error:', participantsRes.error.message);
      return jsonError('Failed to load participants', 500);
    }

    // Build a Set of guest list phone blind indices for quick lookup (determines join source)
    const guestPhoneBiSet = new Set(
      (guestPhonesRes.data || []).map((g: { phone_bi: string | null }) => g.phone_bi).filter(Boolean) as string[]
    );

    // Mask phone for admin display: "+972501234567" → "050-***-4567"
    const maskPhone = (phone: string | null): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 7) return '***';
      return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
    };

    // Enrich with profile_complete, masked phone, and join_source
    const enriched = (participantsRes.data || []).map((p) => {
      const phone = readPhone(p);
      const phoneBi = (p as Record<string, unknown>).phone_bi as string | null ?? computeBlindIndex(phone);
      return {
        ...p,
        profile_complete: !!(p.display_name && p.display_name.trim() && p.age != null),
        phone: maskPhone(phone),
        join_source: phoneBi && guestPhoneBiSet.has(phoneBi) ? 'pre_event_link' : 'qr_on_spot',
      };
    });

    return NextResponse.json({ participants: enriched });
  } catch (err) {
    logger.error('[ADMIN_PARTICIPANTS_GET] error:', err);
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
  const denied = await adminGuard(req, 'admin-participants-patch', RATE_LIMITS.standard);
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

    // Immediately evict the ban cache so subsequent API calls reflect the change
    evictBanCache(participantId);

    // On ban, revoke all active sessions for this participant (logout-everywhere).
    // Belt-and-suspenders on top of the ban gate: it also keeps pre-ban tokens dead
    // after a later unban. Non-blocking and fully guarded - never fails the ban.
    if (is_banned) {
      void bumpSessionEpoch(participantId);
    }

    adminAuditLog(is_banned ? 'PARTICIPANT_BAN' : 'PARTICIPANT_UNBAN', { eventId, participantId }, req);

    // Sync banned_devices table - ban BOTH fingerprints for stronger enforcement
    const { data: participant } = await supabase
      .from('participants')
      .select('device_fingerprint, hardware_fingerprint')
      .eq('id', participantId)
      .maybeSingle();

    if (participant) {
      const fingerprints = [
        participant.device_fingerprint,
        participant.hardware_fingerprint,
      ].filter(Boolean) as string[];

      if (is_banned) {
        // Insert ban entries for all known fingerprints
        for (const fp of fingerprints) {
          const { error: banErr } = await supabase
            .from('banned_devices')
            .upsert(
              { event_id: eventId, device_fingerprint: fp },
              { onConflict: 'event_id,device_fingerprint', ignoreDuplicates: true }
            );
          if (banErr) logger.error('[ADMIN_PARTICIPANTS_PATCH] banned_devices upsert error:', banErr.message);
        }
      } else {
        // Remove ban entries for all known fingerprints
        for (const fp of fingerprints) {
          const { error: unbanErr } = await supabase
            .from('banned_devices')
            .delete()
            .eq('event_id', eventId)
            .eq('device_fingerprint', fp);
          if (unbanErr) logger.error('[ADMIN_PARTICIPANTS_PATCH] banned_devices delete error:', unbanErr.message);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[ADMIN_PARTICIPANTS_PATCH] error:', err);
    return jsonError('Server error', 500);
  }
}
