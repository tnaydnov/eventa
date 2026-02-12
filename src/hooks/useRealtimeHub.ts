/**
 * useRealtimeHub — React hook wrapper for the RealtimeHub singleton.
 *
 * Components use this hook to subscribe to postgres_changes events.
 * The Hub manages the actual WebSocket lifecycle outside React,
 * so StrictMode double-mount/unmount is harmless.
 */

import { useEffect, useRef } from 'react';
import {
  subscribe,
  type Subscription,
  type PostgresChangeHandler,
  type PostgresBinding,
} from '@/lib/realtimeHub';

interface UseRealtimeOptions {
  /** Unique channel key — same key = same underlying channel */
  channelKey: string;
  /** postgres_changes listeners */
  postgres?: Array<{
    binding: PostgresBinding;
    handler: PostgresChangeHandler;
  }>;
  /** Set to false to disable (e.g. when session is null) */
  enabled?: boolean;
}

/**
 * Subscribe to postgres_changes through the Hub.
 *
 * Handlers are stored in refs so they can update without re-subscribing.
 * The subscription only recreates when channelKey or enabled changes.
 *
 * Usage:
 * ```
 * useRealtimeHub({
 *   channelKey: `chat-room:${conversationId}`,
 *   postgres: [{
 *     binding: { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
 *     handler: (payload) => { ... },
 *   }],
 *   enabled: !!session,
 * });
 * ```
 */
export function useRealtimeHub(options: UseRealtimeOptions): void {
  const { channelKey, postgres, enabled = true } = options;
  const subRef = useRef<Subscription | null>(null);

  // Store latest handlers in refs to avoid re-subscribing on every render
  const postgresRef = useRef(postgres);
  postgresRef.current = postgres;

  useEffect(() => {
    if (!enabled) return;

    // Create stable wrapper handlers that delegate to the latest ref
    // Use binding key for lookup instead of array index to avoid drift on reorder
    const stablePostgres = postgresRef.current?.map((p) => {
      const bk = `${p.binding.event}:${p.binding.schema}:${p.binding.table}:${p.binding.filter || ''}`;
      return {
        binding: p.binding,
        handler: ((payload: Parameters<PostgresChangeHandler>[0]) => {
          const current = postgresRef.current?.find(
            (x) => `${x.binding.event}:${x.binding.schema}:${x.binding.table}:${x.binding.filter || ''}` === bk
          );
          current?.handler(payload);
        }) as PostgresChangeHandler,
      };
    });

    subRef.current = subscribe(channelKey, {
      postgres: stablePostgres || [],
    });

    return () => {
      subRef.current?.unsubscribe();
      subRef.current = null;
    };
    // Only re-subscribe when channelKey or enabled changes
    // Handlers are behind refs and update automatically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, enabled]);
}
