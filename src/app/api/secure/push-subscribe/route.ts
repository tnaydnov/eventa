import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/secure/push-subscribe — Save a push subscription.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'push-sub', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { subscription } = await req.json();

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return jsonError('Invalid subscription object', 400);
    }

    const supabase = getServiceClient();

    // Upsert: same participant + endpoint → update keys
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          participant_id: session.sub,
          event_id: session.eid,
          endpoint: subscription.endpoint,
          keys_p256dh: subscription.keys.p256dh,
          keys_auth: subscription.keys.auth,
        },
        { onConflict: 'participant_id,endpoint' }
      );

    if (error) {
      console.error('[PUSH_SUBSCRIBE] error:', error);
      return jsonError('Failed to save subscription', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUSH_SUBSCRIBE] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * DELETE /api/secure/push-subscribe — Remove a push subscription.
 */
export async function DELETE(req: NextRequest) {
  const guard = await secureGuard(req, 'push-unsub', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { endpoint } = await req.json();
    if (!endpoint) return jsonError('Missing endpoint', 400);

    const supabase = getServiceClient();
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('participant_id', session.sub)
      .eq('endpoint', endpoint);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUSH_UNSUBSCRIBE] error:', err);
    return jsonError('Server error', 500);
  }
}
