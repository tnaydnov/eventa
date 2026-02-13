'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionStore } from '@/lib/store';
import { AnimatePresence, motion } from 'framer-motion';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/* ── Storage key to avoid re-prompting ── */
const PUSH_DISMISSED_KEY = 'eventa_push_dismissed';
const PUSH_REGISTERED_KEY = 'eventa_push_registered';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes to Web Push and sends subscription to server.
 * Returns true on success.
 */
async function subscribeToPush(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) return false;

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();
  const res = await fetch('/api/secure/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      },
    }),
  });

  return res.ok;
}

/**
 * Manages Web Push subscription lifecycle.
 *
 * - If already granted: silently re-registers subscription on mount.
 * - If permission is 'default': shows a banner so user taps to enable
 *   (user gesture required on mobile).
 * - If 'denied' or unsupported: renders nothing.
 */
export default function PushSubscriptionManager() {
  const session = useSessionStore((s) => s.session);
  const [showBanner, setShowBanner] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ── Silent re-registration for already-granted users ── */
  useEffect(() => {
    if (!session) return;
    if (!VAPID_PUBLIC_KEY) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    if (Notification.permission === 'granted') {
      // Already granted — silently refresh the subscription on server
      subscribeToPush()
        .then(() => localStorage.setItem(PUSH_REGISTERED_KEY, '1'))
        .catch(() => {});
      return;
    }

    // Permission is 'default' — decide whether to show the banner
    if (Notification.permission === 'denied') return;
    if (localStorage.getItem(PUSH_DISMISSED_KEY)) return;

    // Show the banner after a short delay
    const timer = setTimeout(() => setShowBanner(true), 2500);
    return () => clearTimeout(timer);
  }, [session]);

  /* ── User taps "Enable" — triggers permission from user gesture ── */
  const handleEnable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await subscribeToPush();
        localStorage.setItem(PUSH_REGISTERED_KEY, '1');
      }
    } catch (err) {
      console.warn('[Push] subscription failed:', err);
    } finally {
      setShowBanner(false);
      setBusy(false);
    }
  }, []);

  /* ── User taps "X" to dismiss ── */
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(PUSH_DISMISSED_KEY, '1');
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
            left: 12,
            right: 12,
            zIndex: 9999,
            background: 'rgba(30, 30, 50, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            direction: 'rtl',
          }}
        >
          <span style={{ fontSize: 28, flexShrink: 0 }}>🔔</span>
          <span style={{ flex: 1, fontSize: 14, color: '#fff', lineHeight: 1.4 }}>
            הפעילו התראות כדי לא לפספס לייקים והודעות
          </span>
          <button
            onClick={handleEnable}
            disabled={busy}
            style={{
              flexShrink: 0,
              background: 'linear-gradient(135deg, #e84393, #fd79a8)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '...' : 'הפעלה'}
          </button>
          <button
            onClick={handleDismiss}
            aria-label="סגירה"
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 20,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
