/// <reference lib="webworker" />

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope & typeof globalThis;

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * Prepend NetworkOnly rules for sensitive API routes so they are
 * never served from the service-worker cache.
 *
 * - /api/admin, /api/auth — session/auth endpoints
 * - /api/secure — all authenticated user endpoints
 * - /api/cleanup, /api/health — infrastructure endpoints
 *
 * The generic "/api/" NetworkFirst entry in defaultCache would
 * otherwise cache GET responses, masking expired sessions or
 * serving stale secure data.
 */
const runtimeCaching = [
  {
    matcher: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
      sameOrigin && (
        url.pathname.startsWith('/api/admin') ||
        url.pathname.startsWith('/api/auth') ||
        url.pathname.startsWith('/api/secure') ||
        url.pathname.startsWith('/api/account') ||
        url.pathname.startsWith('/api/cleanup') ||
        url.pathname.startsWith('/api/health')
      ),
    handler: new NetworkOnly(),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
