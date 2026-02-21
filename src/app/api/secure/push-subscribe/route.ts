import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { secureGuard, jsonError } from '@/lib/route-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/validations';

/**
 * POST /api/secure/push-subscribe — Save a push subscription.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'push-sub', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const raw = await req.json();
    const parsed = pushSubscribeSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError('Invalid subscription object', 400);
    }
    const { subscription } = parsed.data;

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
      logger.error('[PUSH_SUBSCRIBE] error:', error);
      return jsonError('Failed to save subscription', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[PUSH_SUBSCRIBE] error:', err);
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
    const raw = await req.json();
    const parsed = pushUnsubscribeSchema.safeParse(raw);
    if (!parsed.success) return jsonError('Invalid endpoint', 400);
    const { endpoint } = parsed.data;

    const supabase = getServiceClient();
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('participant_id', session.sub)
      .eq('endpoint', endpoint);

    if (deleteError) {
      logger.error('[PUSH_UNSUBSCRIBE] delete error:', deleteError.message);
      return jsonError('Failed to remove subscription', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[PUSH_UNSUBSCRIBE] error:', err);
    return jsonError('Server error', 500);
  }
}
