/**
 * RealtimeHub - Singleton channel manager outside React lifecycle.
 *
 * Architecture:
 * - One shared Supabase Realtime channel per unique key
 * - Reference counting: subscribe once, unsubscribe when last handler leaves
 * - Components call hub.subscribe() via useRealtimeHub hook - never supabase.channel() directly
 * - Survives React StrictMode double-mount, fast-refresh, and navigation
 * - Auto-reconnects when the app returns from background (visibilitychange)
 *
 * Only postgres_changes are used - broadcast was removed as redundant.
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────

export type PostgresChangeHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

export interface PostgresBinding {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema: string;
  table: string;
  filter?: string;
}

interface ManagedChannel {
  channel: RealtimeChannel;
  refCount: number;
  status: 'CONNECTING' | 'SUBSCRIBED' | 'CLOSED';
  postgresHandlers: Map<string, Set<PostgresChangeHandler>>;
  postgresBindings: PostgresBinding[];
  /** Timestamp of the last received event from this channel (used by watchdog) */
  lastEventReceivedAt: number;
  /** Timestamp when the channel was created (initial baseline for watchdog) */
  createdAt: number;
  /** True once this channel has reached SUBSCRIBED at least once — prevents
   * initial-connection CONNECTING from triggering the reconnecting indicator. */
  hasBeenSubscribed: boolean;
}

// ─── Hub Singleton ───────────────────────────────────────────────

const channels = new Map<string, ManagedChannel>();

/** Create a unique handler key for a postgres_changes binding */
function bindingKey(b: PostgresBinding): string {
  return `${b.event}:${b.schema}:${b.table}:${b.filter || ''}`;
}

/**
 * Get or create a managed channel. The channel is subscribed once
 * and stays alive until the last handler unregisters.
 */
function getOrCreate(
  key: string,
  bindings: PostgresBinding[],
): ManagedChannel {
  const existing = channels.get(key);
  if (existing && existing.status !== 'CLOSED') {
    // Warn if new bindings are requested that weren't in the original channel setup
    const existingKeys = new Set(existing.postgresBindings.map(bindingKey));
    for (const b of bindings) {
      const bk = bindingKey(b);
      if (!existingKeys.has(bk)) {
        console.warn(
          `[RealtimeHub] Channel "${key}" reused but missing binding: ${bk}. ` +
          'Events for this binding will not be delivered. Use a unique channelKey.'
        );
      }
    }
    existing.refCount++;
    return existing;
  }

  let ch = supabase.channel(key);

  const postgresHandlers = new Map<string, Set<PostgresChangeHandler>>();

  for (const b of bindings) {
    const bk = bindingKey(b);
    postgresHandlers.set(bk, new Set());

    ch = ch.on(
      'postgres_changes' as 'system',
      {
        event: b.event,
        schema: b.schema,
        table: b.table,
        ...(b.filter ? { filter: b.filter } : {}),
      } as Record<string, string>,
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const m = channels.get(key);
        if (m) {
          m.lastEventReceivedAt = Date.now();
          const handlers = m.postgresHandlers.get(bk);
          if (handlers) {
            for (const h of handlers) h(payload);
          }
        }
      },
    );
  }

  const managed: ManagedChannel = {
    channel: ch,
    refCount: 1,
    status: 'CONNECTING',
    postgresHandlers,
    postgresBindings: bindings,
    lastEventReceivedAt: Date.now(),
    createdAt: Date.now(),
    hasBeenSubscribed: false,
  };

  channels.set(key, managed);

  ch.subscribe((status) => {
    if (channels.get(key) === managed) {
      if (status === 'SUBSCRIBED') {
        managed.status = 'SUBSCRIBED';
        managed.hasBeenSubscribed = true;
      } else if (status === 'CLOSED') {
        managed.status = 'CLOSED';
      } else {
        managed.status = 'CONNECTING';
      }
      // Only notify if the channel has been subscribed before — avoids
      // showing 'reconnecting' during the initial connection handshake.
      if (managed.hasBeenSubscribed || status === 'SUBSCRIBED') {
        notifyConnectionListeners();
      }
    }
  });

  return managed;
}

/** Decrement ref count and remove channel if no more handlers */
function release(key: string): void {
  const managed = channels.get(key);
  if (!managed) return;

  managed.refCount--;
  if (managed.refCount <= 0) {
    supabase.removeChannel(managed.channel);
    managed.status = 'CLOSED';
    channels.delete(key);
  }
}

// ─── Public API ───────────────────────────────────────────────────

export interface Subscription {
  /** Unsubscribe this handler. Safe to call multiple times. */
  unsubscribe: () => void;
}

/**
 * Subscribe to postgres_changes on a channel.
 * The hub manages the channel lifecycle automatically via ref counting.
 */
export function subscribe(
  channelKey: string,
  opts: {
    postgres: Array<{ binding: PostgresBinding; handler: PostgresChangeHandler }>;
  },
): Subscription {
  const allBindings = opts.postgres.map((p) => p.binding);
  const managed = getOrCreate(channelKey, allBindings);

  for (const p of opts.postgres) {
    const bk = bindingKey(p.binding);
    let handlerSet = managed.postgresHandlers.get(bk);
    if (!handlerSet) {
      handlerSet = new Set();
      managed.postgresHandlers.set(bk, handlerSet);
    }
    handlerSet.add(p.handler);
  }

  let unsubscribed = false;
  return {
    unsubscribe: () => {
      if (unsubscribed) return;
      unsubscribed = true;

      for (const p of opts.postgres) {
        const bk = bindingKey(p.binding);
        managed.postgresHandlers.get(bk)?.delete(p.handler);
      }

      release(channelKey);
    },
  };
}

/** Check if a channel is currently subscribed */
export function isSubscribed(channelKey: string): boolean {
  return channels.get(channelKey)?.status === 'SUBSCRIBED';
}

/** Returns true if any active channel that was previously connected is now reconnecting */
export function isAnyChannelReconnecting(): boolean {
  for (const [, managed] of channels) {
    if (managed.refCount > 0 && managed.status === 'CONNECTING' && managed.hasBeenSubscribed) return true;
  }
  return false;
}

// ─── Connection status pub-sub ────────────────────────────────────
type ConnectionStatusListener = (reconnecting: boolean) => void;
const connectionListeners = new Set<ConnectionStatusListener>();

function notifyConnectionListeners(): void {
  const reconnecting = isAnyChannelReconnecting();
  for (const cb of connectionListeners) cb(reconnecting);
}

/**
 * Subscribe to hub-wide connection status changes.
 * Callback fires whenever any channel transitions between CONNECTING and SUBSCRIBED.
 * Returns an unsubscribe function.
 */
export function subscribeConnectionStatus(cb: ConnectionStatusListener): () => void {
  connectionListeners.add(cb);
  return () => connectionListeners.delete(cb);
}

/** Get current status of all managed channels (for debugging) */
export function getStatus(): Record<string, { refCount: number; status: string }> {
  const result: Record<string, { refCount: number; status: string }> = {};
  for (const [key, managed] of channels) {
    result[key] = { refCount: managed.refCount, status: managed.status };
  }
  return result;
}

// ─── Auto-reconnect on app resume ────────────────────────────────
// When the user backgrounds the app (switches to another app, locks phone),
// the WebSocket can silently die. On return, we check all channels and
// re-subscribe any that are no longer SUBSCRIBED.

/** Track reconnect attempt counts per channel key for exponential backoff. */
const channelReconnectAttempts = new Map<string, number>();

/**
 * Rebuild and re-subscribe a single stale channel.
 * On failure (CHANNEL_ERROR / TIMED_OUT) schedules a retry with exponential
 * backoff: base = min(500 * 2^attempt, 30_000) ms, ±25 % jitter.
 * Resets the attempt counter on successful SUBSCRIBED.
 */
function reconnectSingleChannel(key: string): void {
  const managed = channels.get(key);
  if (!managed || managed.refCount <= 0) return;

  try { supabase.removeChannel(managed.channel); } catch { /* already removed */ }

  let ch = supabase.channel(key);
  const newPostgresHandlers = new Map<string, Set<PostgresChangeHandler>>();

  for (const b of managed.postgresBindings) {
    const bk = bindingKey(b);
    const existingHandlers = managed.postgresHandlers.get(bk) || new Set();
    newPostgresHandlers.set(bk, existingHandlers);

    ch = ch.on(
      'postgres_changes' as 'system',
      {
        event: b.event,
        schema: b.schema,
        table: b.table,
        ...(b.filter ? { filter: b.filter } : {}),
      } as Record<string, string>,
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const m = channels.get(key);
        if (m) {
          m.lastEventReceivedAt = Date.now();
          const handlers = m.postgresHandlers.get(bk);
          if (handlers) { for (const h of handlers) h(payload); }
        }
      },
    );
  }

  managed.channel = ch;
  managed.postgresHandlers = newPostgresHandlers;
  managed.status = 'CONNECTING';
  managed.lastEventReceivedAt = Date.now(); // reset baseline on reconnect
  // hasBeenSubscribed stays true — this is a reconnect, not initial connect

  ch.subscribe((status) => {
    if (channels.get(key) !== managed) return;

    if (status === 'SUBSCRIBED') {
      managed.status = 'SUBSCRIBED';
      managed.hasBeenSubscribed = true;
      channelReconnectAttempts.delete(key); // success - reset backoff
      notifyConnectionListeners();

    } else if (status === 'CLOSED') {
      managed.status = 'CLOSED';
      channelReconnectAttempts.delete(key);
      notifyConnectionListeners();

    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      // Exponential backoff: 500 ms * 2^attempt, capped at 30 s, ±25 % jitter
      managed.status = 'CONNECTING';
      notifyConnectionListeners();
      const attempt = (channelReconnectAttempts.get(key) ?? 0) + 1;
      channelReconnectAttempts.set(key, attempt);
      const base = Math.min(500 * Math.pow(2, attempt), 30_000);
      const delay = base * (0.75 + Math.random() * 0.5);
      setTimeout(() => reconnectSingleChannel(key), delay);

    } else {
      managed.status = 'CONNECTING';
      notifyConnectionListeners();
    }
  });
}

function reconnectStaleChannels(): void {
  for (const [key, managed] of channels) {
    if (managed.refCount <= 0) continue;

    // Check actual Supabase channel state
    const state = managed.channel.state;
    if (state === 'joined' || state === 'joining') continue;

    // Channel is stale - tear down and rebuild with backoff
    reconnectSingleChannel(key);
  }
}

// ─── Watchdog timer ───────────────────────────────────────────────
// Every 20 s when the tab is visible, check for channels that claim to be
// 'joined' but have not delivered any event in the last 60 s (silent TCP drop).
// Force a channel rebuild in that case.
const WATCHDOG_CHECK_MS = 20_000;
const WATCHDOG_STALE_MS = 60_000;

if (typeof window !== 'undefined') {
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    for (const [, managed] of channels) {
      if (managed.refCount <= 0) continue;
      // Only watch channels the Supabase client thinks are "joined"
      if (managed.channel.state !== 'joined') continue;
      const sinceLastEvent = now - managed.lastEventReceivedAt;
      if (sinceLastEvent > WATCHDOG_STALE_MS) {
        // Force channel rebuild - same logic as reconnectStaleChannels
        // but we treat it as stale even though state === 'joined'
        managed.status = 'CLOSED';
        managed.channel.state = 'closed' as never; // trick reconnect to pick it up
        reconnectStaleChannels();
        break; // reconnectStaleChannels loops everything; avoid double-processing
      }
    }
  }, WATCHDOG_CHECK_MS);
}

// Listen for app resume (visibility change)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Small delay to let the network stack wake up
      setTimeout(reconnectStaleChannels, 500);
    }
  });
}

// iOS Safari fires pagehide/pageshow for app-switcher navigation
// (these don't always trigger visibilitychange)
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', () => {
    setTimeout(reconnectStaleChannels, 500);
  });

  // Also reconnect when coming back online
  window.addEventListener('online', () => {
    setTimeout(reconnectStaleChannels, 1000);
  });
}
