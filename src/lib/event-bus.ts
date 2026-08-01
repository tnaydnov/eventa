/**
 * In-process event bus - fire-and-forget, no persistence.
 *
 * Usage:
 *   import { eventBus } from '@/lib/event-bus';
 *   eventBus.emit('like_sent', { event_id: '...', from: '...', to: '...' });
 *   const unsub = eventBus.subscribe('like_sent', (payload) => { ... });
 *   unsub(); // cleanup
 */

export type EventBusPayload = {
  qr_scan: { event_id: string; session_id?: string };
  join_page_view: { event_id: string; session_id?: string };
  otp_requested: { event_id: string; phone_hash: string };
  otp_verified: { event_id: string; participant_id: string; session_id: string };
  profile_complete: { event_id: string; participant_id: string };
  like_sent: { event_id: string; from_id: string; to_id: string };
  match_created: { event_id: string; participant_a: string; participant_b: string; conversation_id: string };
  message_sent: { event_id: string; conversation_id: string; sender_id: string; has_image: boolean };
  conversation_opened: { event_id: string; participant_id: string; conversation_id: string };
};

export type EventBusEvent = keyof EventBusPayload;

type Listener<K extends EventBusEvent> = (payload: EventBusPayload[K]) => void;

class EventBus {
  private readonly listeners = new Map<string, Set<Listener<EventBusEvent>>>();

  emit<K extends EventBusEvent>(event: K, payload: EventBusPayload[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    // Fire-and-forget: execute handlers asynchronously to avoid blocking callers
    for (const handler of handlers) {
      Promise.resolve().then(() => {
        try {
          (handler as Listener<K>)(payload);
        } catch {
          // Swallow errors - event bus must never crash the caller
        }
      });
    }
  }

  subscribe<K extends EventBusEvent>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<EventBusEvent>);
    return () => {
      this.listeners.get(event)?.delete(listener as Listener<EventBusEvent>);
    };
  }
}

// Singleton - shared across the entire Node.js process
export const eventBus = new EventBus();
