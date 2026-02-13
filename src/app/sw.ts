/// <reference lib="webworker" />

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope & typeof globalThis;

const sw = self as unknown as ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/* ─── Web Push Notifications ─── */

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

sw.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data: PushPayload = event.data.json();

    const options: NotificationOptions & { renotify?: boolean } = {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-192x192.png',
      dir: 'rtl' as NotificationDirection,
      lang: 'he',
      tag: data.tag || 'eventa-notification',
      renotify: true,
      data: { url: data.url || '/dating' },
    };

    event.waitUntil(
      sw.registration.showNotification(data.title, options)
    );
  } catch {
    // Malformed push payload — ignore
  }
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url || '/dating';

  event.waitUntil(
    sw.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if available
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              (client as WindowClient).navigate(url);
            }
            return;
          }
        }
        // Otherwise open new window
        return sw.clients.openWindow(url);
      })
  );
});
