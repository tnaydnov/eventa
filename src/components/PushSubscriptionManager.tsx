'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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
 * Manages Web Push subscription lifecycle.
 * - On mount (when session exists): requests permission, subscribes, sends to server.
 * - Silently no-ops if notifications aren't supported or user denies.
 */
export default function PushSubscriptionManager() {
  const session = useSessionStore((s) => s.session);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!session || subscribedRef.current) return;
    if (!VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // Don't re-prompt if user previously denied
    if (Notification.permission === 'denied') return;

    const subscribe = async () => {
      try {
        // Request permission (shows native prompt if 'default')
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription first
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // Send subscription to server
        const subJson = subscription.toJSON();
        await fetch('/api/secure/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
            },
          }),
        });

        subscribedRef.current = true;
      } catch (err) {
        // Silently fail — push is a nice-to-have
        console.warn('[Push] subscription failed:', err);
      }
    };

    // Small delay so it doesn't interfere with initial page load
    const timer = setTimeout(subscribe, 3000);
    return () => clearTimeout(timer);
  }, [session]);

  return null;
}
