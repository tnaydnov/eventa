/**
 * Notification dispatcher - enqueues SMS notifications into pending_sms.
 *
 * Presence check: considers participant online if last_seen_at within 60s.
 * Quota rules:
 *   - like: max 1 per hour per recipient
 *   - message: max 1 per 15 minutes per recipient
 *   - match: max 1 per match (deduped by pending queue check)
 *   - abandoned_funnel / inactivity: max 5 total OOA per event
 *
 * All functions are fire-and-forget safe (never throw, log errors internally).
 */
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  likeNotificationSmsText,
  matchNotificationSmsText,
  messageNotificationSmsText,
  abandonedFunnelSmsText,
  inactivitySmsText,
} from '@/lib/messaging/templates';

const PRESENCE_WINDOW_MS = 60_000; // 60 seconds
const LIKE_DELAY_MS = 2 * 60_000;    // 2 minutes - user has time to return
const MESSAGE_DELAY_MS = 90_000;      // 90 seconds
const MATCH_DELAY_MS = 0;             // no delay - match is high-value, send as soon as cron runs (~60s max)
const LIKE_QUOTA_MS = 60 * 60_000; // 1 hour
const MESSAGE_QUOTA_MS = 15 * 60_000; // 15 minutes
const INACTIVITY_DELAY_MS = 30 * 60_000; // 30 minutes
const MAX_OOA_SMS_PER_EVENT = 5;
// Match SMS is excluded from the OOA cap - it's the highest-value notification
// and must not be silently blocked by testing/spam-prevention counters.
const OOA_CAPPED_TYPES = ['like', 'message', 'abandoned_funnel', 'inactivity'] as const;
const OOA_MESSAGE_TYPES = ['like', 'message', 'match', 'abandoned_funnel', 'inactivity'] as const;

type ParticipantInfo = {
  id: string;
  phone: string;
  event_id: string;
  sms_consent: boolean;
  sms_notifications_enabled: boolean;
  tab_visible: boolean;
  last_seen_at: string | null;
};

type EventInfo = {
  id: string;
  slug: string;
  name: string;
  sms_notifications_enabled: boolean;
};

/** Returns true if participant is considered online (active in last 60s and tab visible) */
function isOnline(p: ParticipantInfo): boolean {
  // Trust the explicit tab_visible=false signal over last_seen_at.
  // When the user leaves the browser, a keepalive fires immediately with tab_visible=false.
  // Relying on last_seen_at in this case causes false "online" for up to 60s after the user leaves.
  if (!p.tab_visible) return false;
  // tab_visible=true: verify with heartbeat freshness (handles browser crash / killed app)
  if (!p.last_seen_at) return false;
  return Date.now() - new Date(p.last_seen_at).getTime() < PRESENCE_WINDOW_MS;
}

/** Fetch participant with all needed fields */
async function getParticipant(participantId: string): Promise<ParticipantInfo | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('participants')
    .select('id, phone, event_id, sms_consent, sms_notifications_enabled, tab_visible, last_seen_at')
    .eq('id', participantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ParticipantInfo;
}

/** Fetch event with SMS flag */
async function getEvent(eventId: string): Promise<EventInfo | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, name, sms_notifications_enabled')
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EventInfo;
}

/** Check if a quota-limited SMS type was already sent within the window */
async function isQuotaExceeded(
  participantId: string,
  eventId: string,
  messageType: string,
  windowMs: number
): Promise<boolean> {
  const supabase = getServiceClient();
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data } = await supabase
    .from('sms_quotas')
    .select('id')
    .eq('participant_id', participantId)
    .eq('event_id', eventId)
    .eq('message_type', messageType)
    .gte('sent_at', since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Check if participant has opted out globally */
async function isOptedOut(phone: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('sms_optout')
    .select('id')
    .eq('phone', phone)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Enqueue an SMS into pending_sms */
async function enqueue(
  eventId: string,
  recipientId: string,
  phone: string,
  messageType: string,
  body: string,
  delayMs = 0
): Promise<void> {
  const supabase = getServiceClient();
  const scheduledAt = new Date(Date.now() + delayMs).toISOString();
  const { error } = await supabase.from('pending_sms').insert({
    event_id: eventId,
    recipient_id: recipientId,
    phone,
    message_type: messageType,
    body,
    scheduled_at: scheduledAt,
  });
  if (error) {
    logger.error('[NOTIFICATION_DISPATCHER] enqueue error:', error.message);
  }
}

/** True when participant reached total per-event OOA SMS cap (sent + still pending). */
async function hasReachedEventSmsCap(participantId: string, eventId: string): Promise<boolean> {
  const supabase = getServiceClient();

  const [sentRes, pendingRes] = await Promise.all([
    supabase
      .from('sms_quotas')
      .select('id')
      .eq('participant_id', participantId)
      .eq('event_id', eventId)
      .in('message_type', [...OOA_CAPPED_TYPES]),
    supabase
      .from('pending_sms')
      .select('id')
      .eq('recipient_id', participantId)
      .eq('event_id', eventId)
      .in('message_type', [...OOA_CAPPED_TYPES])
      .is('sent_at', null)
      .is('cancelled_at', null),
  ]);

  const sentCount = sentRes.data?.length ?? 0;
  const pendingCount = pendingRes.data?.length ?? 0;
  return sentCount + pendingCount >= MAX_OOA_SMS_PER_EVENT;
}

/** Returns true if participant already engaged (sent a like or message) in this event. */
async function hasParticipantEngaged(participantId: string, eventId: string): Promise<boolean> {
  const supabase = getServiceClient();
  const [likesRes, messagesRes] = await Promise.all([
    supabase
      .from('likes')
      .select('id')
      .eq('event_id', eventId)
      .eq('from_participant_id', participantId)
      .limit(1),
    supabase
      .from('messages')
      .select('id')
      .eq('event_id', eventId)
      .eq('sender_participant_id', participantId)
      .limit(1),
  ]);

  return (likesRes.data?.length ?? 0) > 0 || (messagesRes.data?.length ?? 0) > 0;
}

/**
 * Enqueue a "like" notification SMS to the recipient.
 * Skips if: online, opted out, quota exceeded, SMS disabled.
 */
export async function enqueueLikeNotification(
  recipientId: string,
  eventId: string
): Promise<void> {
  try {
    const [participant, event] = await Promise.all([
      getParticipant(recipientId),
      getEvent(eventId),
    ]);
    if (!participant || !event) return;
    if (!event.sms_notifications_enabled) return;
    if (!participant.sms_consent || !participant.sms_notifications_enabled) return;
    if (isOnline(participant)) return;
    if (await isOptedOut(participant.phone)) return;
    if (await hasReachedEventSmsCap(recipientId, eventId)) return;
    if (await isQuotaExceeded(recipientId, eventId, 'like', LIKE_QUOTA_MS)) return;

    const body = likeNotificationSmsText(event.name, event.slug);
    // 2-minute delay: gives the user time to return to the app before sending.
    await enqueue(eventId, recipientId, participant.phone, 'like', body, LIKE_DELAY_MS);
  } catch (err) {
    logger.error('[NOTIFICATION_DISPATCHER] enqueueLikeNotification error:', err);
  }
}

/**
 * Enqueue a "match" notification SMS to both participants in a match.
 * Always enqueues (no enqueue-time online check) to avoid the race where a
 * match happens milliseconds after the user leaves the browser (before
 * tab_visible=false reaches the DB). The dispatch cron cancels the SMS at
 * send-time if the recipient is back online by then.
 */
export async function enqueueMatchNotification(
  participantAId: string,
  participantBId: string,
  eventId: string
): Promise<void> {
  try {
    const [event] = await Promise.all([getEvent(eventId)]);
    if (!event || !event.sms_notifications_enabled) return;

    for (const recipientId of [participantAId, participantBId]) {
      const participant = await getParticipant(recipientId);
      if (!participant) continue;
      if (!participant.sms_consent || !participant.sms_notifications_enabled) continue;
      if (await isOptedOut(participant.phone)) continue;
      if (await hasReachedEventSmsCap(recipientId, eventId)) continue;
      // Dedup: skip if a match SMS is already pending for this recipient
      const supabase = getServiceClient();
      const { data: existing } = await supabase
        .from('pending_sms')
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('event_id', eventId)
        .eq('message_type', 'match')
        .is('sent_at', null)
        .is('cancelled_at', null)
        .limit(1);
      if ((existing?.length ?? 0) > 0) continue;

      // Cancel any pending like SMS for this recipient - the match notification supersedes it
      await supabase
        .from('pending_sms')
        .update({ cancelled_at: new Date().toISOString(), cancel_reason: 'superseded_by_match' })
        .eq('recipient_id', recipientId)
        .eq('event_id', eventId)
        .eq('message_type', 'like')
        .is('sent_at', null)
        .is('cancelled_at', null);

      const body = matchNotificationSmsText(event.name, event.slug);
      // 30s delay: gives users a chance to see the in-app match popup first.
      // The dispatch cron will cancel if the user is back in the app by then.
      await enqueue(eventId, recipientId, participant.phone, 'match', body, MATCH_DELAY_MS);
    }
  } catch (err) {
    logger.error('[NOTIFICATION_DISPATCHER] enqueueMatchNotification error:', err);
  }
}

/**
 * Enqueue a "message" notification SMS to the recipient.
 * Skips if: online, quota exceeded, etc.
 */
export async function enqueueMessageNotification(
  recipientId: string,
  eventId: string
): Promise<void> {
  try {
    const [participant, event] = await Promise.all([
      getParticipant(recipientId),
      getEvent(eventId),
    ]);
    if (!participant || !event) return;
    if (!event.sms_notifications_enabled) return;
    if (!participant.sms_consent || !participant.sms_notifications_enabled) return;
    if (isOnline(participant)) return;
    if (await isOptedOut(participant.phone)) return;
    if (await hasReachedEventSmsCap(recipientId, eventId)) return;
    if (await isQuotaExceeded(recipientId, eventId, 'message', MESSAGE_QUOTA_MS)) return;

    const body = messageNotificationSmsText(event.name, event.slug);
    // 90-second delay: gives user a chance to return before sending.
    await enqueue(eventId, recipientId, participant.phone, 'message', body, MESSAGE_DELAY_MS);
  } catch (err) {
    logger.error('[NOTIFICATION_DISPATCHER] enqueueMessageNotification error:', err);
  }
}

/**
 * Schedule an abandoned-funnel SMS for a participant who just verified OTP
 * but hasn't completed profile setup. Fires at +15 minutes.
 * Safe to call multiple times - skips if a pending row already exists.
 */
export async function enqueueAbandonedFunnelSms(
  participantId: string,
  eventId: string
): Promise<void> {
  try {
    const [participant, event] = await Promise.all([
      getParticipant(participantId),
      getEvent(eventId),
    ]);
    if (!participant || !event) return;
    if (!event.sms_notifications_enabled) return;
    if (!participant.sms_consent || !participant.sms_notifications_enabled) return;
    if (await isOptedOut(participant.phone)) return;
    if (await hasReachedEventSmsCap(participantId, eventId)) return;

    // Idempotency: skip if a pending (not yet sent, not cancelled) row already exists.
    const supabase = getServiceClient();
    const { data: existing } = await supabase
      .from('pending_sms')
      .select('id')
      .eq('recipient_id', participantId)
      .eq('event_id', eventId)
      .eq('message_type', 'abandoned_funnel')
      .is('sent_at', null)
      .is('cancelled_at', null)
      .limit(1);
    if ((existing?.length ?? 0) > 0) return;

    const body = abandonedFunnelSmsText(event.name, event.slug);
    await enqueue(eventId, participantId, participant.phone, 'abandoned_funnel', body, 15 * 60_000);
  } catch (err) {
    logger.error('[NOTIFICATION_DISPATCHER] enqueueAbandonedFunnelSms error:', err);
  }
}

/**
 * Schedule an inactivity nudge at +30 minutes after profile completion.
 * Sends only if user did not send any like/message yet.
 */
export async function enqueueInactivitySms(
  participantId: string,
  eventId: string
): Promise<void> {
  try {
    const [participant, event] = await Promise.all([
      getParticipant(participantId),
      getEvent(eventId),
    ]);
    if (!participant || !event) return;
    if (!event.sms_notifications_enabled) return;
    if (!participant.sms_consent || !participant.sms_notifications_enabled) return;
    if (await isOptedOut(participant.phone)) return;
    if (await hasReachedEventSmsCap(participantId, eventId)) return;

    // If already engaged, do not schedule an inactivity nudge.
    if (await hasParticipantEngaged(participantId, eventId)) return;

    const supabase = getServiceClient();

    // Idempotency: one pending inactivity nudge at a time per participant/event.
    const { data: pending } = await supabase
      .from('pending_sms')
      .select('id')
      .eq('recipient_id', participantId)
      .eq('event_id', eventId)
      .eq('message_type', 'inactivity')
      .is('sent_at', null)
      .is('cancelled_at', null)
      .limit(1);
    if ((pending?.length ?? 0) > 0) return;

    // Skip if inactivity nudge already sent before for this participant/event.
    if (await isQuotaExceeded(participantId, eventId, 'inactivity', 365 * 24 * 60 * 60_000)) return;

    const body = inactivitySmsText(event.name, event.slug);
    await enqueue(eventId, participantId, participant.phone, 'inactivity', body, INACTIVITY_DELAY_MS);
  } catch (err) {
    logger.error('[NOTIFICATION_DISPATCHER] enqueueInactivitySms error:', err);
  }
}
