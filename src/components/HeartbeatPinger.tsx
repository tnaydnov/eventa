'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';
import { LEGACY_LOCAL_ID_KEY } from '@/lib/constants';

/**
 * HeartbeatPinger - sends a POST to /api/secure/heartbeat every 60 seconds
 * while the user has an active session and the tab is visible.
 *
 * Also sends an immediate heartbeat on mount and when returning from background.
 * Resets the interval cadence on visibility change so timing stays accurate.
 * Retries once after ~5s if the network request fails.
 * Sends `tab_visible: true` so the server can cancel pending SMS on return.
 *
 * If the server responds with 403 (banned), immediately clears the session
 * and redirects the user to the banned screen.
 */
const HEARTBEAT_INTERVAL_MS = 60_000;
const RETRY_DELAY_BASE_MS = 5_000;

export default function HeartbeatPinger() {
  const participantId = useSessionStore((s) => s.session?.participantId);
  const eventSlug = useSessionStore((s) => s.session?.eventSlug);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!participantId) return;

    const controller = new AbortController();

    const sendHeartbeat = (attempt = 0) => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/secure/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_visible: true }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (res.status === 403) {
            useSessionStore.getState().clearSession();
            localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
            window.location.href = eventSlug ? `/${eventSlug}/banned` : '/';
          } else if (res.status === 410) {
            const body = await res.json().catch(() => ({}));
            const reason = body.reason || 'deleted';
            useSessionStore.getState().clearSession();
            localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
            window.location.href = eventSlug ? `/${eventSlug}/unavailable?reason=${reason}` : '/';
          }
        })
        .catch(() => {
          // Retry once after ~5s + jitter on network failure
          if (attempt === 0 && !controller.signal.aborted) {
            const delay = RETRY_DELAY_BASE_MS + Math.random() * 2_000;
            setTimeout(() => sendHeartbeat(1), delay);
          }
        });
    };

    const resetInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    };

    // Send immediately on mount and start interval
    sendHeartbeat();
    resetInterval();

    // On visibility → visible: fire immediately AND reset the interval cadence
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        resetInterval();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [participantId, eventSlug]);

  return null; // Renders nothing
}
