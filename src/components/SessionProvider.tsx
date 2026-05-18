'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useSessionStore } from '@/lib/store';
import { supabase, setEventContext } from '@/lib/supabase';
import { getMyPhotos } from '@/lib/api';
import { useAppResume } from '@/hooks/useAppResume';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { LEGACY_LOCAL_ID_KEY, SESSION_STORAGE_KEY } from '@/lib/constants';

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
          // User is banned - clear everything and redirect
          useSessionStore.getState().clearSession();
          localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
          window.location.href = `/${eventSlug}/banned`;
          return;
        } else if (res.status === 410) {
          // Event is inactive (paused/archived/deleted)
          const body = await res.json().catch(() => ({}));
          const reason = body.reason || 'deleted';
          // Only redirect to unavailable if the cookie belonged to THIS event.
          // Otherwise the cookie was for a different (now-inactive) event -
          // just clear it and fall through so the page can handle QR join etc.
          if (body.eventSlug === eventSlug) {
            useSessionStore.getState().clearSession();
            localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
            window.location.href = `/${eventSlug}/unavailable?reason=${reason}`;
            return;
          }
          // Stale cookie for another event - clear local state and continue
          useSessionStore.getState().clearSession();
        }
      } catch {
        // Cookie verification failed, try localStorage fallback
      }

      // Fallback: try restoring from localStorage (backward compat)
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
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
          // corrupt data - remove it
          localStorage.removeItem(SESSION_STORAGE_KEY);
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
          // Session is still valid - refresh store in case anything changed
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
        // User was banned while in background - kick them
        useSessionStore.getState().clearSession();
        localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
        window.location.href = `/${eventSlug}/banned`;
        return;
      } else if (res.status === 410) {
        // Event became inactive while in background
        const body = await res.json().catch(() => ({}));
        const reason = body.reason || 'deleted';
        // Only redirect if the cookie belonged to this event
        if (body.eventSlug === eventSlug) {
          useSessionStore.getState().clearSession();
          localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
          window.location.href = `/${eventSlug}/unavailable?reason=${reason}`;
          return;
        }
      }
      // If verify fails for other reasons, the existing localStorage session still works
      // (JWT cookies are complementary to localStorage sessions)
    } catch {
      // Network error - keep existing session
    } finally {
      verifyingRef.current = false;
    }
  }, restored);

  // Load the user's own photos into the store so MatchPopup etc. can display them
  useEffect(() => {
    if (!session?.participantId) return;
    // Only fetch if photos aren't already loaded
    if (useSessionStore.getState().photos.length > 0) return;
    getMyPhotos(session.participantId)
      .then((photos) => {
        useSessionStore.getState().setPhotos(photos);
      })
      .catch((err) => {
        console.error('[SessionProvider] Failed to load photos:', err);
      });
  }, [session?.participantId]);

  // Refresh event name & background from DB
  useEffect(() => {
    if (!session?.eventId) return;

    Promise.resolve(
      supabase
        .from('events')
        .select('name, background_image')
        .eq('id', session.eventId)
        .single()
    )
      .then(({ data, error }) => {
        if (error) {
          console.error('[SessionProvider] event-meta query error:', error.message);
          return;
        }
        if (data) {
          // Read fresh session from store to avoid stale closure
          const current = useSessionStore.getState().session;
          if (!current) return;
          const needsUpdate =
            (data.name && data.name !== current.eventName) ||
            data.background_image !== current.backgroundImage;
          if (needsUpdate) {
            const updated = {
              ...current,
              eventName: data.name || current.eventName,
              backgroundImage: data.background_image ?? null,
            };
            useSessionStore.getState().setSession(updated);
          }
        }
      })
      .catch((err: unknown) => {
        console.error('[SessionProvider] Failed to refresh event meta:', err);
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
          const updated = payload.new as {
            name?: string;
            background_image?: string | null;
            status?: string;
            is_active?: boolean;
          };
          const current = useSessionStore.getState().session;
          if (!current) return;

          // If event became paused/archived - kick user immediately
          if (
            updated.status === 'paused' ||
            updated.status === 'archived'
          ) {
            const reason = updated.status;
            useSessionStore.getState().clearSession();
            localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
            window.location.href = `/${eventSlug}/unavailable?reason=${reason}`;
            return;
          }

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
