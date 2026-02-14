'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useSessionStore } from '@/lib/store';
import { supabase, setEventContext } from '@/lib/supabase';
import { useAppResume } from '@/hooks/useAppResume';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';

/**
 * Restores the session from httpOnly cookie (via /api/auth/verify)
 * with localStorage fallback for backward compatibility.
 * Re-validates when the app returns from background.
 * All event pages should be wrapped in this.
 */
export default function SessionProvider({
  eventSlug,
  children,
}: {
  eventSlug: string;
  children: ReactNode;
}) {
  const session = useSessionStore((s) => s.session);
  const [restored, setRestored] = useState(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    // If the store already has the right session, we're good
    if (session?.eventSlug === eventSlug) {
      setEventContext(session.eventId);
      setRestored(true);
      return;
    }

    // Try verifying session from httpOnly cookie first
    async function verifySession() {
      try {
        const res = await fetch('/api/auth/verify');
        if (res.ok) {
          const data = await res.json();
          if (data.eventSlug === eventSlug) {
            setEventContext(data.eventId);
            useSessionStore.getState().setSession({
              eventId: data.eventId,
              eventSlug: data.eventSlug,
              eventName: data.eventName,
              participantId: data.participantId,
            });
            setRestored(true);
            return;
          }
        } else if (res.status === 403) {
          // User is banned — clear everything and redirect
          useSessionStore.getState().clearSession();
          localStorage.removeItem('wedding_local_id');
          window.location.href = `/dating/${eventSlug}/banned`;
          return;
        }
      } catch {
        // Cookie verification failed, try localStorage fallback
      }

      // Fallback: try restoring from localStorage (backward compat)
      const stored = localStorage.getItem('eventa_session');
      if (stored) {
        try {
          const s = JSON.parse(stored);
          // Validate required fields before trusting localStorage data
          if (s.eventSlug === eventSlug && s.eventId && s.participantId) {
            setEventContext(s.eventId);
            useSessionStore.getState().setSession(s);
            setRestored(true);
            return;
          }
        } catch {
          // corrupt data — remove it
          localStorage.removeItem('eventa_session');
        }
      }

      setRestored(true);
    }

    verifySession();
  }, [eventSlug, session]);

  // Re-verify session when returning from background (JWT may have expired)
  useAppResume(async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    try {
      const res = await fetch('/api/auth/verify');
      if (res.ok) {
        const data = await res.json();
        if (data.eventSlug === eventSlug) {
          // Session is still valid — refresh store in case anything changed
          const current = useSessionStore.getState().session;
          if (!current || current.participantId !== data.participantId) {
            useSessionStore.getState().setSession({
              eventId: data.eventId,
              eventSlug: data.eventSlug,
              eventName: data.eventName,
              participantId: data.participantId,
            });
          }
        }
      } else if (res.status === 403) {
        // User was banned while in background — kick them
        useSessionStore.getState().clearSession();
        localStorage.removeItem('wedding_local_id');
        window.location.href = `/dating/${eventSlug}/banned`;
        return;
      }
      // If verify fails for other reasons, the existing localStorage session still works
      // (JWT cookies are complementary to localStorage sessions)
    } catch {
      // Network error — keep existing session
    } finally {
      verifyingRef.current = false;
    }
  }, restored);

  // Refresh event name & background from DB
  useEffect(() => {
    if (!session?.eventId) return;

    supabase
      .from('events')
      .select('name, background_image')
      .eq('id', session.eventId)
      .single()
      .then(({ data }) => {
        if (data) {
          const needsUpdate =
            (data.name && data.name !== session.eventName) ||
            data.background_image !== session.backgroundImage;
          if (needsUpdate) {
            const updated = {
              ...session,
              eventName: data.name || session.eventName,
              backgroundImage: data.background_image ?? null,
            };
            useSessionStore.getState().setSession(updated);
          }
        }
      });
  }, [session?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for realtime changes to the event (background image, name, etc.)
  useRealtimeHub({
    channelKey: `event-meta:${session?.eventId}`,
    postgres: [
      {
        binding: {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${session?.eventId}`,
        },
        handler: (payload) => {
          const updated = payload.new as { name?: string; background_image?: string | null };
          const current = useSessionStore.getState().session;
          if (!current) return;

          const needsUpdate =
            (updated.name && updated.name !== current.eventName) ||
            updated.background_image !== current.backgroundImage;

          if (needsUpdate) {
            useSessionStore.getState().setSession({
              ...current,
              eventName: updated.name || current.eventName,
              backgroundImage: updated.background_image ?? null,
            });
          }
        },
      },
    ],
    enabled: !!session?.eventId,
  });

  if (!restored) return null;

  return <>{children}</>;
}
