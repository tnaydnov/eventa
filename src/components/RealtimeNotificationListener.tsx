'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { useSessionStore, useNotificationStore, useToastStore, useMatchStore } from '@/lib/store';
import { getUnseenLikes, getUnreadConversations, getPhotoUrl } from '@/lib/api';
import type { Like, Message } from '@/lib/database.types';

/**
 * Global realtime listener mounted in event layout.
 * Uses RealtimeHub for stable subscriptions (survives StrictMode).
 * Initializes unread state from DB on mount, then uses realtime + polling.
 */
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

  const handleLike = async (likeId: string, fromId: string) => {
    if (seenIds.current.has(`like:${likeId}`)) return;
    markSeen(`like:${likeId}`);
    const s = sessionRef.current;
    if (!s) return;
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
        photoUrl: theirPhotos?.[0] ? getPhotoUrl(theirPhotos[0].storage_path) : null,
      });
    } else {
      toast(`💖 ${name} שלח/ה לך לייק!`);
    }
  };

  const handleMessage = async (msgId: string, senderId: string, conversationId: string, text: string | null, type: string) => {
    if (seenIds.current.has(`msg:${msgId}`)) return;
    markSeen(`msg:${msgId}`);
    if (type === 'system') return; // don't count system messages as unread
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
          handleLike(like.id, like.from_participant_id);
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
          handleMessage(msg.id, msg.sender_participant_id, msg.conversation_id, msg.text, msg.type);
        },
      },
    ],
    enabled: !!session,
  });

  // ─── Polling fallback ─────────────────────────────────────
  const pollRef = useRef<() => Promise<void>>(async () => {});
  pollRef.current = async () => {
    const s = sessionRef.current;
    if (!s) return;
    const now = new Date().toISOString();

    try {
      // Prune old dedup entries to prevent unbounded memory growth
      pruneSeenIds();

      // Fire independent queries in parallel
      const [{ data: newLikes }, freshConvoIds] = await Promise.all([
        supabase
          .from('likes').select('id, from_participant_id')
          .eq('event_id', s.eventId).eq('to_participant_id', s.participantId)
          .gt('created_at', lastPollTsRef.current).order('created_at', { ascending: true }),
        refreshMyConvoIds(),
      ]);

      if (newLikes) for (const like of newLikes) handleLike(like.id, like.from_participant_id);

      const myConvoIds = [...freshConvoIds];

      // Messages + reconciliation in parallel
      const [msgResult, reconcileResult] = await Promise.all([
        myConvoIds.length > 0
          ? supabase
              .from('messages').select('id, sender_participant_id, conversation_id, text, type')
              .eq('event_id', s.eventId).neq('sender_participant_id', s.participantId)
              .in('conversation_id', myConvoIds)
              .gt('created_at', lastPollTsRef.current).order('created_at', { ascending: true })
          : Promise.resolve({ data: null }),
        // Reconcile: remove stale like highlights
        (async () => {
          const store = useNotificationStore.getState();
          const likeHighlights = store.gridHighlights.filter((h) => h.type === 'like');
          if (likeHighlights.length === 0) return;
          const { data: currentLikes } = await supabase
            .from('likes')
            .select('from_participant_id')
            .eq('event_id', s.eventId)
            .eq('to_participant_id', s.participantId)
            .is('seen_at', null);
          const activeLikerIds = new Set((currentLikes || []).map((l) => l.from_participant_id));
          for (const h of likeHighlights) {
            if (!activeLikerIds.has(h.participantId)) {
              useNotificationStore.getState().removeGridHighlightByType(h.participantId, 'like');
              useNotificationStore.getState().decrementLikes();
            }
          }
        })(),
      ]);

      if (msgResult?.data) {
        for (const msg of msgResult.data) handleMessage(msg.id, msg.sender_participant_id, msg.conversation_id, msg.text, msg.type);
      }

      lastPollTsRef.current = now;
    } catch (err) {
      console.error('[RealtimeNotificationListener] poll error:', err);
      // Don't update lastPollTsRef so the next poll retries from the same timestamp
    }
  };

  useEffect(() => {
    if (!session) return;
    lastPollTsRef.current = new Date().toISOString();

    // Poll every 15s (realtime handles most updates; this is a safety net).
    // Pause when tab is hidden to avoid wasting bandwidth.
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => pollRef.current?.(), 15_000);
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        // Catch up immediately when returning, then resume interval
        pollRef.current?.();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session]);

  // Catch up immediately when returning from background
  useAppResume(() => { pollRef.current?.(); }, !!session);

  return null;
}
