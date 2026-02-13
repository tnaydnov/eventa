/**
 * Server-side Web Push helper.
 * Sends push notifications to all registered subscriptions for a participant.
 */
import webpush from 'web-push';
import { getServiceClient } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@eventa.productions',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to all subscriptions of a participant.
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToParticipant(
  participantId: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const supabase = getServiceClient();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('participant_id', participantId);

  if (!subs || subs.length === 0) return;

  const jsonPayload = JSON.stringify(payload);
  const expiredIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth,
            },
          },
          jsonPayload,
          { TTL: 60 * 60 } // 1 hour
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 or 410 = subscription expired/unsubscribed
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds);
  }
}
