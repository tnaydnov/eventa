'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';

/**
 * HeartbeatPinger - sends a POST to /api/secure/heartbeat every 60 seconds
 * while the user has an active session and the tab is visible.
 *
 * Also sends an immediate heartbeat on mount and when returning from background.
 * This feeds the activity_log table for usage timeline analytics.
 *
 * If the server responds with 403 (banned), immediately clears the session
 * and redirects the user to the banned screen.
 */
const HEARTBEAT_INTERVAL_MS = 60_000;

export default function HeartbeatPinger() {
  const participantId = useSessionStore((s) => s.session?.participantId);
  const eventSlug = useSessionStore((s) => s.session?.eventSlug);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!participantId) return;

    const controller = new AbortController();

    const sendHeartbeat = () => {
      // Only send when the tab is visible
      if (document.visibilityState !== 'visible') return;
      fetch('/api/secure/heartbeat', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      })
        .then(async (res) => {
          if (res.status === 403) {
            // User has been banned - clear session and redirect
            useSessionStore.getState().clearSession();
            localStorage.removeItem('wedding_local_id');
            if (eventSlug) {
              window.location.href = `/dating/${eventSlug}/banned`;
            } else {
              window.location.href = '/dating';
            }
          } else if (res.status === 410) {
            // Event is inactive (paused/archived/deleted) - kick user
            const body = await res.json().catch(() => ({}));
            const reason = body.reason || 'deleted';
            useSessionStore.getState().clearSession();
            localStorage.removeItem('wedding_local_id');
            if (eventSlug) {
              window.location.href = `/dating/${eventSlug}/unavailable?reason=${reason}`;
            } else {
              window.location.href = '/dating';
            }
          }
        })
        .catch(() => { /* ignore network failures silently */ });
    };

    // Send immediately on mount
    sendHeartbeat();

    // Set up periodic heartbeat
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Also send a heartbeat when returning from background
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
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
