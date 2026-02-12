'use client';

import { useEffect, useState } from 'react';

/**
 * Shows a floating banner when the device goes offline.
 * Auto-hides when connectivity returns, with a brief "back online" confirmation.
 * Mounted inside the event layout so it's always visible.
 */
export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initialize with current state
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div
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
        background: online ? '#4caf50' : '#f44336',
        transition: 'background 0.3s, opacity 0.3s',
        opacity: online && showReconnected ? 0.95 : 1,
      }}
    >
      {online ? '✓ חזרתם לרשת' : '⚡ אין חיבור לאינטרנט'}
    </div>
  );
}
