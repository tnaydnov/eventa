/**
 * Unit tests for lib/chat-outbox.ts — durable chat outbox (§23.1 / R1).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadOutbox, addToOutbox, removeFromOutbox, newOutboxKey, type OutboxEntry,
} from '@/lib/chat-outbox';

const CONV = 'conv-1';
const entry = (key: string, text = 'hi'): OutboxEntry => ({ key, conversationId: CONV, text, createdAt: Date.now() });

beforeEach(() => {
  window.localStorage.clear();
});

describe('chat-outbox', () => {
  it('newOutboxKey returns a non-empty unique string', () => {
    const a = newOutboxKey();
    const b = newOutboxKey();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('starts empty and round-trips an added entry', () => {
    expect(loadOutbox(CONV)).toEqual([]);
    const e = entry('k1', 'hello');
    addToOutbox(e);
    const loaded = loadOutbox(CONV);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ key: 'k1', text: 'hello', conversationId: CONV });
  });

  it('replaces an entry with the same key instead of duplicating', () => {
    addToOutbox(entry('k1', 'first'));
    addToOutbox(entry('k1', 'second'));
    const loaded = loadOutbox(CONV);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].text).toBe('second');
  });

  it('removes an entry by key (and clears storage when empty)', () => {
    addToOutbox(entry('k1'));
    addToOutbox(entry('k2'));
    removeFromOutbox(CONV, 'k1');
    expect(loadOutbox(CONV).map((e) => e.key)).toEqual(['k2']);
    removeFromOutbox(CONV, 'k2');
    expect(loadOutbox(CONV)).toEqual([]);
    expect(window.localStorage.getItem('chat-outbox:' + CONV)).toBeNull();
  });

  it('isolates entries per conversation', () => {
    addToOutbox(entry('k1'));
    addToOutbox({ key: 'k2', conversationId: 'conv-2', text: 'x', createdAt: Date.now() });
    expect(loadOutbox(CONV)).toHaveLength(1);
    expect(loadOutbox('conv-2')).toHaveLength(1);
  });

  it('tolerates corrupt storage without throwing', () => {
    window.localStorage.setItem('chat-outbox:' + CONV, '{not json');
    expect(loadOutbox(CONV)).toEqual([]);
  });

  it('caps the queue at 50 entries (keeps the most recent)', () => {
    for (let i = 0; i < 60; i++) addToOutbox(entry('k' + i, 't' + i));
    const loaded = loadOutbox(CONV);
    expect(loaded).toHaveLength(50);
    // Oldest 10 dropped; newest retained.
    expect(loaded[0].key).toBe('k10');
    expect(loaded[loaded.length - 1].key).toBe('k59');
  });
});
