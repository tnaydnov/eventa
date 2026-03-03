import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';

/**
 * PATCH /api/admin/events/[eventId]/qr-sent
 * Manually toggle the qr_page_sent flag on an event.
 *
 * Body (JSON): { sent: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const denied = adminGuard(req, 'admin-toggle-qr-sent', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const inv = validateEventId(eventId);
  if (inv) return inv;

  try {
    const { sent } = await req.json();
    if (typeof sent !== 'boolean') {
      return jsonError('sent must be a boolean', 400);
    }

    const supabase = getServiceClient();
    const { error } = await supabase
      .from('events')
      .update({ qr_page_sent: sent })
      .eq('id', eventId);

    if (error) {
      return jsonError('Failed to update', 500);
    }

    return NextResponse.json({ success: true, qr_page_sent: sent });
  } catch {
    return jsonError('Failed to update QR sent status', 500);
  }
}
