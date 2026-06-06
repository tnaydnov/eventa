'use client';

import { useEffect, useState } from 'react';

/**
 * Shows a floating banner when the device goes offline or when the
 * realtime WebSocket is reconnecting after a stale/dropped connection.
 * Auto-hides when connectivity returns, with a brief "back online" confirmation.
 * Mounted inside the event layout so it's always visible.
 */
export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initialize with current state
    setOnline(navigator.onLine);

    let reconnectedTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      reconnectedTimer = setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (reconnectedTimer) clearTimeout(reconnectedTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !showReconnected) return null;

  // While offline, show the offline banner
  if (!online) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 600,
          color: 'white',
          background: '#f44336',
          transition: 'background 0.3s',
        }}
      >
        <span aria-hidden="true">⚡ </span>אין חיבור לאינטרנט
      </div>
    );
  }

  // "Back online" confirmation
  if (showReconnected) {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 600,
          color: 'white',
          background: '#4caf50',
          opacity: 0.95,
          transition: 'background 0.3s',
        }}
      >
        <span aria-hidden="true">✓ </span>חזרתם לרשת
      </div>
    );
  }

  // Fallback - should not be reached
  return null;
}
