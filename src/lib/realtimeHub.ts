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
        const handlers = channels.get(key)?.postgresHandlers.get(bk);
        if (handlers) {
          for (const h of handlers) h(payload);
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
  };

  channels.set(key, managed);

  ch.subscribe((status) => {
    if (channels.get(key) === managed) {
      managed.status = status === 'SUBSCRIBED' ? 'SUBSCRIBED' : status === 'CLOSED' ? 'CLOSED' : 'CONNECTING';
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

function reconnectStaleChannels(): void {
  for (const [key, managed] of channels) {
    if (managed.refCount <= 0) continue;

    // Check actual Supabase channel state
    const state = managed.channel.state;
    if (state === 'joined' || state === 'joining') continue;

    // Channel is stale - tear down and rebuild
    try { supabase.removeChannel(managed.channel); } catch { /* already removed */ }

    let ch = supabase.channel(key);
    const newPostgresHandlers = new Map<string, Set<PostgresChangeHandler>>();

    for (const b of managed.postgresBindings) {
      const bk = bindingKey(b);
      // Preserve existing handlers
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
          const handlers = channels.get(key)?.postgresHandlers.get(bk);
          if (handlers) {
            for (const h of handlers) h(payload);
          }
        },
      );
    }

    managed.channel = ch;
    managed.postgresHandlers = newPostgresHandlers;
    managed.status = 'CONNECTING';

    ch.subscribe((status) => {
      if (channels.get(key) === managed) {
        managed.status = status === 'SUBSCRIBED' ? 'SUBSCRIBED' : status === 'CLOSED' ? 'CLOSED' : 'CONNECTING';
      }
    });
  }
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

// Also reconnect when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(reconnectStaleChannels, 1000);
  });
}
