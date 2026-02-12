'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';

/**
 * HeartbeatPinger — sends a POST to /api/secure/heartbeat every 60 seconds
 * while the user has an active session and the tab is visible.
 *
 * Also sends an immediate heartbeat on mount and when returning from background.
 * This feeds the activity_log table for usage timeline analytics.
 */
const HEARTBEAT_INTERVAL_MS = 60_000;

export default function HeartbeatPinger() {
  const session = useSessionStore((s) => s.session);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) return;

    const sendHeartbeat = () => {
      // Only send when the tab is visible
      if (document.visibilityState !== 'visible') return;
      fetch('/api/secure/heartbeat', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => { /* ignore failures silently */ });
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
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [session]);

  return null; // Renders nothing
}
