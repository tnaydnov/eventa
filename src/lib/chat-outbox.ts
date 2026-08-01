/**
 * Durable chat outbox (SECURITY_HARDENING_PLAN §23.1 / R1).
 *
 * At a crowded venue a message can fail to send after all in-flight retries (e.g. a
 * 20s dead zone). Previously the optimistic bubble was removed and the typed text was
 * lost. This outbox persists unsent text messages to localStorage so they survive a
 * reload / iOS tab-kill, can be shown as "failed - tap to retry", and are auto-flushed
 * on reconnect. Each entry carries a STABLE idempotency key, so replaying it is safe -
 * the messages API deduplicates by `Idempotency-Key`, so a resend can never create a
 * duplicate even if the original actually reached the server.
 *
 * Scope: text messages only. Image messages reference a File that cannot be persisted
 * across reloads, so they keep their existing in-session failure handling.
 */

export interface OutboxEntry {
  /** Stable idempotency key - reused on every retry so the server dedupes replays. */
  key: string;
  conversationId: string;
  text: string;
  createdAt: number;
}

/** Max entries kept per conversation (guards against unbounded localStorage growth). */
const MAX_ENTRIES = 50;

function storageKey(conversationId: string): string {
  return `chat-outbox:${conversationId}`;
}

/** Generate a stable idempotency key for a new outbox entry. */
export function newOutboxKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Read the persisted outbox for a conversation (oldest first). Never throws. */
export function loadOutbox(conversationId: string): OutboxEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        e && typeof e.key === 'string' && typeof e.text === 'string' && typeof e.conversationId === 'string',
    );
  } catch {
    return [];
  }
}

function writeOutbox(conversationId: string, entries: OutboxEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    if (trimmed.length === 0) {
      window.localStorage.removeItem(storageKey(conversationId));
    } else {
      window.localStorage.setItem(storageKey(conversationId), JSON.stringify(trimmed));
    }
  } catch {
    /* private-mode / quota - non-critical, the in-memory UI state still works */
  }
}

/** Add (or replace by key) an entry in the outbox. */
export function addToOutbox(entry: OutboxEntry): void {
  const entries = loadOutbox(entry.conversationId).filter((e) => e.key !== entry.key);
  entries.push(entry);
  writeOutbox(entry.conversationId, entries);
}

/** Remove an entry by key once it has been confirmed sent. */
export function removeFromOutbox(conversationId: string, key: string): void {
  const entries = loadOutbox(conversationId).filter((e) => e.key !== key);
  writeOutbox(conversationId, entries);
}
