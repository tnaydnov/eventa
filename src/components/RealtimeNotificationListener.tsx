'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { useSessionStore, useNotificationStore, useToastStore, useMatchStore } from '@/lib/store';
import { getUnseenLikes, getUnreadConversations, getPhotoUrl, getNotificationDeltas } from '@/lib/api';
import { isSubscribed } from '@/lib/realtimeHub';
import type { Like, Message } from '@/lib/database.types';

/** Polling interval when the tab is visible (safety-net catch-up). */
const POLL_INTERVAL_VISIBLE_MS = 8_000;
/** Polling interval when the tab is hidden (save bandwidth). */
const POLL_INTERVAL_HIDDEN_MS = 15_000;
/** Temporary fast polling interval after reconnect issues are detected. */
const POLL_INTERVAL_BURST_MS = 5_000;
/** Keep burst mode for this long after stale detection. */
const POLL_BURST_DURATION_MS = 3 * 60_000;
/** How long to wait before showing the stale-connection indicator (ms). */
const STALE_THRESHOLD_MS = 60_000;

/**
 * Fractional jitter applied to every poll interval (±20%).
 * At a crowded venue hundreds of clients can drop to polling at once; without
 * jitter they would all query Postgres on the same cadence, creating synchronized
 * load spikes ("thundering herd"). Randomising each interval spreads that load.
 */
const POLL_JITTER_PCT = 0.2;
/** Max random delay (ms) before the immediate catch-up poll on resume/reconnect,
 * so a venue-wide reconnect doesn't fire every client's poll in the same instant. */
const CATCHUP_SPREAD_MS = 800;

/** Return `base` ms scaled by ±POLL_JITTER_PCT. */
function jitter(base: number): number {
  return Math.round(base * (1 + (Math.random() * 2 - 1) * POLL_JITTER_PCT));
}

type DeliverySource = 'ws' | 'poll';

function sendReliabilityTelemetry(payload: {
  metricType: 'realtime_disconnect' | 'realtime_recovered' | 'notification_delivery';
  eventId?: string;
  source?: 'ws' | 'poll' | 'unknown';
  value?: number;
  metadata?: Record<string, unknown>;
}) {
  const body = JSON.stringify({
    metricType: payload.metricType,
    event_id: payload.eventId,
    source: payload.source,
    value: payload.value,
    metadata: payload.metadata,
  });
  const url = '/api/telemetry/reliability';

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => { /* non-critical */ });
  }
}

export default function RealtimeNotificationListener() {
  const session = useSessionStore((s) => s.session);
  const toast = useToastStore((s) => s.show);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const seenIds = useRef(new Set<string>());
  const seenTimestamps = useRef(new Map<string, number>()); // Track when IDs were added
  const sessionRef = useRef(session);
  const lastPollTsRef = useRef(new Date().toISOString());
  const myConvoIdsRef = useRef(new Set<string>());
  sessionRef.current = session;

  // Helper: refresh the full set of my conversation IDs (full replace, not merge-only)
  const refreshMyConvoIds = async (): Promise<Set<string>> => {
    const s = sessionRef.current;
    if (!s) return myConvoIdsRef.current;
    const { data } = await supabase
      .from('conversations').select('id')
      .eq('event_id', s.eventId)
      .or(`a_participant_id.eq.${s.participantId},b_participant_id.eq.${s.participantId}`);
    if (data) {
      myConvoIdsRef.current = new Set(data.map((c) => c.id));
    }
    return myConvoIdsRef.current;
  };

  // Helper: prune seenIds older than 5 minutes to prevent unbounded growth
  const pruneSeenIds = () => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, ts] of seenTimestamps.current) {
      if (ts < cutoff) {
        seenIds.current.delete(key);
        seenTimestamps.current.delete(key);
      }
    }
  };

  // Helper: track a seen ID with timestamp
  const markSeen = (key: string) => {
    seenIds.current.add(key);
    seenTimestamps.current.set(key, Date.now());
  };

  // Helper: check if current user is a member of a conversation (cache-first, single-row fallback)
  const isMyConversation = async (conversationId: string): Promise<boolean> => {
    if (myConvoIdsRef.current.has(conversationId)) return true;
    // Could be a brand-new conversation - do a targeted lookup
    const s = sessionRef.current;
    if (!s) return false;
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('event_id', s.eventId)
      .or(`a_participant_id.eq.${s.participantId},b_participant_id.eq.${s.participantId}`)
      .maybeSingle();
    if (data) {
      myConvoIdsRef.current.add(conversationId);
      return true;
    }
    return false;
  };

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // ─── Initialize unread state from DB ──────────────────────
  useEffect(() => {
    if (!session) return;
    const store = useNotificationStore.getState();
    if (store._initialized) return;

    (async () => {
      try {
        const [unseenLikeSenders, unreadConvos] = await Promise.all([
          getUnseenLikes(session.eventId, session.participantId),
          getUnreadConversations(session.eventId, session.participantId),
        ]);

        // Populate grid highlights for unseen likes
        for (const senderId of unseenLikeSenders) {
          useNotificationStore.getState().addGridHighlight({
            participantId: senderId,
            type: 'like',
            timestamp: Date.now(),
          });
        }
        useNotificationStore.getState().setUnreadLikes(unseenLikeSenders.length);

        // Populate grid highlights for unread messages + track unread convos
        const convoIds: string[] = [];
        for (const uc of unreadConvos) {
          useNotificationStore.getState().addGridHighlight({
            participantId: uc.otherParticipantId,
            type: 'message',
            timestamp: Date.now(),
          });
          convoIds.push(uc.conversationId);
        }
        useNotificationStore.getState().initializeUnreadConvos(convoIds);
        useNotificationStore.getState().setInitialized(true);

        // Pre-seed conversation ID cache for realtime filtering
        refreshMyConvoIds();
      } catch (err) {
        console.error('[RealtimeNotificationListener] init error:', err);
        // Mark initialized anyway to prevent infinite retries
        useNotificationStore.getState().setInitialized(true);
      }
    })();
  }, [session]);

  // Stable name cache with TTL (5 min) - prevents stale names + unbounded growth
  const nameCache = useRef(new Map<string, { name: string; ts: number }>());
  const NAME_CACHE_TTL = 5 * 60 * 1000;
  const NAME_CACHE_MAX = 200;
  const getName = async (id: string): Promise<string> => {
    const cached = nameCache.current.get(id);
    const now = Date.now();
    if (cached && now - cached.ts < NAME_CACHE_TTL) return cached.name;
    // Prune expired entries if cache exceeds max size
    if (nameCache.current.size >= NAME_CACHE_MAX) {
      for (const [key, entry] of nameCache.current.entries()) {
        if (now - entry.ts >= NAME_CACHE_TTL) nameCache.current.delete(key);
      }
    }
    const { data } = await supabase.from('participants').select('display_name').eq('id', id).single();
    const name = data?.display_name || 'מישהו';
    nameCache.current.set(id, { name, ts: now });
    return name;
  };

  const handleLike = async (likeId: string, fromId: string, source: DeliverySource) => {
    if (seenIds.current.has(`like:${likeId}`)) return;
    markSeen(`like:${likeId}`);
    const s = sessionRef.current;
    if (!s) return;
    sendReliabilityTelemetry({
      metricType: 'notification_delivery',
      eventId: s.eventId,
      source,
      metadata: { kind: 'like' },
    });
    const name = await getName(fromId);
    useNotificationStore.getState().addGridHighlight({ participantId: fromId, type: 'like', timestamp: Date.now() });
    useNotificationStore.getState().incrementLikes();

    // Check if this creates a match (did I already like this person?)
    const { data: iLikedThem } = await supabase
      .from('likes')
      .select('id')
      .eq('event_id', s.eventId)
      .eq('from_participant_id', s.participantId)
      .eq('to_participant_id', fromId)
      .maybeSingle();

    if (iLikedThem) {
      // It's a match! Fetch their photo for the popup
      const { data: theirPhotos } = await supabase
        .from('participant_photos')
        .select('storage_path')
        .eq('participant_id', fromId)
        .order('order_index')
        .limit(1);

      useMatchStore.getState().setPendingMatch({
        id: fromId,
        displayName: name,
        photoUrl: theirPhotos?.[0]
          ? getPhotoUrl(theirPhotos[0].storage_path, { width: 480, height: 640, quality: 80 })
          : null,
      });
    } else {
      toast(`💖 ${name} שלח/ה לך לייק!`);
    }
  };

  const handleMessage = async (
    msgId: string,
    senderId: string,
    conversationId: string,
    text: string | null,
    type: string,
    source: DeliverySource,
  ) => {
    if (seenIds.current.has(`msg:${msgId}`)) return;
    markSeen(`msg:${msgId}`);
    if (type === 'system') return; // don't count system messages as unread
    const s = sessionRef.current;
    if (s) {
      sendReliabilityTelemetry({
        metricType: 'notification_delivery',
        eventId: s.eventId,
        source,
        metadata: { kind: 'message' },
      });
    }
    const name = await getName(senderId);
    if (!pathnameRef.current.includes(`/chat/${conversationId}`)) {
      useNotificationStore.getState().addGridHighlight({ participantId: senderId, type: 'message', timestamp: Date.now() });
      useNotificationStore.getState().addUnreadConvo(conversationId);
      const preview = type === 'text' ? (text || '').slice(0, 40) : '📷 תמונה';
      toast(`💬 ${name}: ${preview}`);
    }
  };

  const handleLikeRemoved = async (fromId: string) => {
    const s = sessionRef.current;
    if (!s) return;
    useNotificationStore.getState().removeGridHighlightByType(fromId, 'like');
    useNotificationStore.getState().decrementLikes();
    const name = await getName(fromId);
    toast(`💔 ${name} הסיר/ה את הלייק`);
  };

  // ─── Realtime via Hub (stable, outside React lifecycle) ───
  useRealtimeHub({
    channelKey: `live-notify:${session?.eventId}:${session?.participantId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'likes', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const like = payload.new as Like;
          if (like.to_participant_id !== sessionRef.current?.participantId) return;
          handleLike(like.id, like.from_participant_id, 'ws');
        },
      },
      {
        binding: { event: 'DELETE', schema: 'public', table: 'likes', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const old = payload.old as Partial<Like>;
          // Supabase DELETE payloads only include columns in REPLICA IDENTITY.
          // Guard against missing fields to prevent runtime errors.
          if (!old.to_participant_id || !old.from_participant_id) return;
          if (old.to_participant_id !== sessionRef.current?.participantId) return;
          handleLikeRemoved(old.from_participant_id);
        },
      },
      {
        binding: { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${session?.eventId}` },
        handler: async (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_participant_id === sessionRef.current?.participantId) return;
          // Only process messages from conversations I'm part of
          if (!(await isMyConversation(msg.conversation_id))) return;
          handleMessage(msg.id, msg.sender_participant_id, msg.conversation_id, msg.text, msg.type, 'ws');
        },
      },
    ],
    enabled: !!session,
  });

  // ─── Polling fallback ─────────────────────────────────────
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const burstUntilRef = useRef(0);
  const restartPollingRef = useRef<((visible: boolean) => void) | null>(null);
  pollRef.current = async () => {
    const s = sessionRef.current;
    if (!s) return;
    // Capture the cursor once for this poll. We advance it to the SERVER's clock
    // (returned by the endpoint), never the device clock - a phone with a skewed
    // clock would otherwise permanently miss or re-deliver events.
    const cursor = lastPollTsRef.current;

    try {
      // Prune old dedup entries to prevent unbounded memory growth
      pruneSeenIds();

      // Single consolidated delta fetch (one round trip; queries run server-side,
      // connection-pooled). Replaces the previous ~4 direct Supabase queries per poll
      // - see GET /api/secure/since (§23.4/R6). `seenIds` dedup in handleLike/handleMessage
      // makes any cursor-boundary overlap harmless.
      const deltas = await getNotificationDeltas(cursor);
      if (!deltas) return; // fetch failed - keep the cursor and retry on the next tick

      // Refresh my conversation-membership cache from the server's authoritative list
      // (used by realtime INSERT filtering in isMyConversation).
      myConvoIdsRef.current = new Set(deltas.myConversationIds);

      for (const like of deltas.likes) {
        handleLike(like.id, like.from_participant_id, 'poll');
      }

      for (const msg of deltas.messages) {
        handleMessage(msg.id, msg.sender_participant_id, msg.conversation_id, msg.text, msg.type, 'poll');
      }

      // Reconcile: drop stale "like" highlights for likes that are no longer unseen.
      // Skip entirely when the server couldn't compute the unseen set (null) so we
      // never wrongly clear a highlight.
      if (deltas.unseenLikeSenders !== null) {
        const activeLikerIds = new Set(deltas.unseenLikeSenders);
        const likeHighlights = useNotificationStore.getState().gridHighlights.filter((h) => h.type === 'like');
        for (const h of likeHighlights) {
          if (!activeLikerIds.has(h.participantId)) {
            useNotificationStore.getState().removeGridHighlightByType(h.participantId, 'like');
            useNotificationStore.getState().decrementLikes();
          }
        }
      }

      // Advance to the server's clock. If the fetch returned nothing new, this simply
      // moves the window forward to "now" so the next poll covers only newer rows.
      lastPollTsRef.current = deltas.serverNow;
    } catch (err) {
      console.error('[RealtimeNotificationListener] poll error:', err);
      // Don't update lastPollTsRef so the next poll retries from the same cursor
    }
  };

  useEffect(() => {
    if (!session) return;
    // Seed the poll cursor from the SERVER's own row timestamps, not the device
    // clock - a skewed phone clock could otherwise miss or re-deliver events.
    // We set a synchronous client-time baseline first (so polling can start
    // immediately) and replace it with the newest existing server row timestamp
    // when the seed query returns - but only if no poll has advanced it meanwhile.
    const baseline = new Date().toISOString();
    lastPollTsRef.current = baseline;
    void (async () => {
      const s = sessionRef.current;
      if (!s) return;
      try {
        const [{ data: lk }, { data: mg }] = await Promise.all([
          supabase.from('likes').select('created_at')
            .eq('event_id', s.eventId).eq('to_participant_id', s.participantId)
            .order('created_at', { ascending: false }).limit(1),
          supabase.from('messages').select('created_at')
            .eq('event_id', s.eventId)
            .order('created_at', { ascending: false }).limit(1),
        ]);
        const candidates = [lk?.[0]?.created_at, mg?.[0]?.created_at].filter(Boolean) as string[];
        if (candidates.length && lastPollTsRef.current === baseline) {
          candidates.sort();
          lastPollTsRef.current = candidates[candidates.length - 1];
        }
      } catch {
        /* keep the client-clock baseline on error */
      }
    })();

    // Self-rescheduling, jittered poll loop (setTimeout, not setInterval): each
    // client polls on a slightly different cadence so a venue-wide drop to polling
    // doesn't create synchronized DB load spikes. Realtime handles most updates;
    // this is the safety net.
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const startPolling = (visible: boolean) => {
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
      const schedule = () => {
        if (stopped) return;
        const now = Date.now();
        const inBurst = visible && burstUntilRef.current > now;
        const base = inBurst
          ? POLL_INTERVAL_BURST_MS
          : (visible ? POLL_INTERVAL_VISIBLE_MS : POLL_INTERVAL_HIDDEN_MS);
        pollTimer = setTimeout(async () => {
          await pollRef.current?.();
          schedule(); // reschedule with fresh jitter each tick
        }, jitter(base));
      };
      schedule();
    };
    restartPollingRef.current = startPolling;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        startPolling(false);
      } else {
        // Catch up immediately when returning, then resume faster interval
        pollRef.current?.();
        startPolling(true);
      }
    };

    // iOS Safari app-switching path: pagehide/pageshow do not always emit visibilitychange.
    const handlePageHide = () => startPolling(false);
    const handlePageShow = () => {
      pollRef.current?.();
      startPolling(true);
    };

    startPolling(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      restartPollingRef.current = null;
    };
  }, [session]);

  // Stale-connection check: every 20s, check if our realtime channel is still subscribed.
  // Show the "מסנכרן..." indicator in the header when the channel has been unreachable for >60s.
  useEffect(() => {
    if (!session) return;
    const channelKey = `live-notify:${session.eventId}:${session.participantId}`;
    let staleStart: number | null = null;
    let disconnectLogged = false;

    const checkInterval = setInterval(() => {
      const subscribed = isSubscribed(channelKey);
      if (!subscribed) {
        if (staleStart === null) staleStart = Date.now();
        if (Date.now() - staleStart > STALE_THRESHOLD_MS) {
          useNotificationStore.getState().setRealtimeStale(true);
          if (!disconnectLogged) {
            sendReliabilityTelemetry({
              metricType: 'realtime_disconnect',
              eventId: session.eventId,
              source: 'unknown',
            });
            disconnectLogged = true;
          }
          // Temporarily tighten polling cadence to reduce notification delay
          // while the websocket path is recovering.
          burstUntilRef.current = Date.now() + POLL_BURST_DURATION_MS;
          if (document.visibilityState === 'visible') {
            restartPollingRef.current?.(true);
            // Stale detection fires across many clients at once when a venue tower
            // drops; spread the immediate catch-up poll over a short random window
            // so they don't all hit Postgres in the same instant.
            setTimeout(() => pollRef.current?.(), Math.random() * CATCHUP_SPREAD_MS);
          }
        }
      } else {
        if (disconnectLogged) {
          sendReliabilityTelemetry({
            metricType: 'realtime_recovered',
            eventId: session.eventId,
            source: 'ws',
          });
        }
        disconnectLogged = false;
        staleStart = null;
        useNotificationStore.getState().setRealtimeStale(false);
      }
    }, 20_000);

    return () => {
      clearInterval(checkInterval);
      useNotificationStore.getState().setRealtimeStale(false);
    };
  }, [session]);

  // Catch up immediately when returning from background
  useAppResume(() => { pollRef.current?.(); }, !!session);

  return null;
}
