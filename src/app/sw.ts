/// <reference lib="webworker" />

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, StaleWhileRevalidate, CacheFirst, ExpirationPlugin, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope & typeof globalThis;

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * Runtime caching rules (in priority order - first match wins):
 *
 * 1. NetworkOnly for all auth, admin, and mutating secure requests.
 *    These must never be served from cache (session-sensitive).
 *
 * 2. StaleWhileRevalidate for explicitly safe secure GETs:
 *    participants grid + conversations list (30s), message history (10s).
 *    Lets a returning user see data immediately while the fresh
 *    response loads in the background. Realtime channel catches up.
 *
 * 3. CacheFirst (7 days) for Supabase Storage photo objects.
 *    Profile photos rarely change; re-downloading 30 grid images every
 *    cold start is the dominant data cost at a crowded venue.
 *
 * 4. defaultCache handles everything else (Next.js static assets, etc.).
 */
const runtimeCaching = [
  // ── 1. Network-only: auth + admin + secure mutations ──────────
  {
    matcher: ({ sameOrigin, url, request }: { sameOrigin: boolean; url: URL; request: Request }) =>
      sameOrigin && (
        // All API mutations must never be cached.
        (url.pathname.startsWith('/api/') && request.method !== 'GET') ||
        url.pathname.startsWith('/api/admin') ||
        url.pathname.startsWith('/api/auth') ||
        url.pathname.startsWith('/api/account') ||
        url.pathname.startsWith('/api/cleanup') ||
        url.pathname.startsWith('/api/health') ||
        // All non-GET secure requests (POST, DELETE, PATCH) must be network-only
        (url.pathname.startsWith('/api/secure') && request.method !== 'GET')
      ),
    handler: new NetworkOnly(),
  },

  // ── 2a. StaleWhileRevalidate: participants + conversations ───
  {
    matcher: ({ sameOrigin, url, request }: { sameOrigin: boolean; url: URL; request: Request }) =>
      sameOrigin &&
      request.method === 'GET' &&
      (url.pathname === '/api/secure/participants' || url.pathname === '/api/secure/conversations'),
    handler: new StaleWhileRevalidate({
      cacheName: 'secure-reads-v1',
      plugins: [
        new ExpirationPlugin({ maxAgeSeconds: 30, maxEntries: 60 }),
      ],
    }),
  },

  // ── 2b. StaleWhileRevalidate: message history (shorter TTL) ──
  {
    matcher: ({ sameOrigin, url, request }: { sameOrigin: boolean; url: URL; request: Request }) =>
      sameOrigin &&
      request.method === 'GET' &&
      (url.pathname === '/api/secure/messages' || url.pathname === '/api/secure/messages/before'),
    handler: new StaleWhileRevalidate({
      cacheName: 'secure-messages-v1',
      plugins: [
        new ExpirationPlugin({ maxAgeSeconds: 10, maxEntries: 120 }),
      ],
    }),
  },

  // ── 2c. Network-only fallback: all other secure GETs ─────────
  {
    matcher: ({ sameOrigin, url, request }: { sameOrigin: boolean; url: URL; request: Request }) =>
      sameOrigin && url.pathname.startsWith('/api/secure') && request.method === 'GET',
    handler: new NetworkOnly(),
  },

  // ── 3. CacheFirst: Supabase Storage profile photos ────────────
  {
    matcher: ({ url }: { url: URL }) =>
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/'),
    handler: new CacheFirst({
      cacheName: 'supabase-photos-v1',
      plugins: [
        new ExpirationPlugin({ maxAgeSeconds: 7 * 24 * 60 * 60, maxEntries: 200 }),
      ],
    }),
  },

  // ── 4. Default: Next.js static assets & everything else ───────
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
