/**
 * Unit tests for stores/chats.ts — Chats Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatsStore } from '@/lib/stores/chats';
import type { ConversationWithDetails } from '@/lib/stores/chats';

const makeConversation = (id: string, lastAt: string): ConversationWithDetails => ({
  id,
  event_id: 'event-1',
  participant_1: 'p1',
  participant_2: 'p2',
  created_at: '2024-01-01T00:00:00Z',
  last_message_at: lastAt,
  otherParticipant: {
    id: 'p2',
    event_id: 'event-1',
    display_name: 'User',
    gender: 'female' as any,
    attracted_to: 'men' as any,
    age: 25,
    bio: null,
    city: null,
    looking_for: null,
    is_banned: false,
    created_at: '',
    photos: [],
  },
  lastMessageText: 'Hello',
  unreadCount: 0,
});

const makeMessage = (id: string) => ({
  id,
  conversation_id: 'c1',
  sender_id: 'p1',
  text: 'Test message',
  type: 'text' as const,
  media_url: null,
  created_at: new Date().toISOString(),
});

beforeEach(() => {
  useChatsStore.getState().reset();
});

describe('useChatsStore', () => {
  it('initial state is empty', () => {
    const s = useChatsStore.getState();
    expect(s.conversations).toEqual([]);
    expect(s.currentMessages).toEqual([]);
  });

  it('setConversations stores conversations', () => {
    const convos = [makeConversation('c1', '2024-01-01T12:00:00Z')];
    useChatsStore.getState().setConversations(convos);
    expect(useChatsStore.getState().conversations).toHaveLength(1);
  });

  it('addMessage appends to currentMessages', () => {
    useChatsStore.getState().addMessage(makeMessage('m1') as any);
    useChatsStore.getState().addMessage(makeMessage('m2') as any);
    expect(useChatsStore.getState().currentMessages).toHaveLength(2);
  });

  it('setCurrentMessages replaces all messages', () => {
    useChatsStore.getState().addMessage(makeMessage('m1') as any);
    useChatsStore.getState().setCurrentMessages([makeMessage('m3') as any]);
    expect(useChatsStore.getState().currentMessages).toHaveLength(1);
    expect(useChatsStore.getState().currentMessages[0].id).toBe('m3');
  });

  it('removeConversation removes by ID', () => {
    useChatsStore.getState().setConversations([
      makeConversation('c1', '2024-01-01T12:00:00Z'),
      makeConversation('c2', '2024-01-01T13:00:00Z'),
    ]);
    useChatsStore.getState().removeConversation('c1');
    const convos = useChatsStore.getState().conversations;
    expect(convos).toHaveLength(1);
    expect(convos[0].id).toBe('c2');
  });

  it('updateConversationPreview updates text and sorts', () => {
    useChatsStore.getState().setConversations([
      makeConversation('c1', '2024-01-01T12:00:00Z'),
      makeConversation('c2', '2024-01-01T11:00:00Z'),
    ]);
    useChatsStore.getState().updateConversationPreview('c2', 'New msg', '2024-01-01T14:00:00Z', false);
    const convos = useChatsStore.getState().conversations;
    // c2 should be first now (more recent)
    expect(convos[0].id).toBe('c2');
    expect(convos[0].lastMessageText).toBe('New msg');
  });

  it('updateConversationPreview increments unread when requested', () => {
    useChatsStore.getState().setConversations([makeConversation('c1', '2024-01-01T12:00:00Z')]);
    useChatsStore.getState().updateConversationPreview('c1', 'msg', '2024-01-01T13:00:00Z', true);
    expect(useChatsStore.getState().conversations[0].unreadCount).toBe(1);
    useChatsStore.getState().updateConversationPreview('c1', 'msg2', '2024-01-01T14:00:00Z', true);
    expect(useChatsStore.getState().conversations[0].unreadCount).toBe(2);
  });

  it('updateConversationPreview does not increment unread when false', () => {
    useChatsStore.getState().setConversations([makeConversation('c1', '2024-01-01T12:00:00Z')]);
    useChatsStore.getState().updateConversationPreview('c1', 'msg', '2024-01-01T13:00:00Z', false);
    expect(useChatsStore.getState().conversations[0].unreadCount).toBe(0);
  });

  it('reset clears all state', () => {
    useChatsStore.getState().setConversations([makeConversation('c1', '2024-01-01T12:00:00Z')]);
    useChatsStore.getState().addMessage(makeMessage('m1') as any);
    useChatsStore.getState().reset();
    const s = useChatsStore.getState();
    expect(s.conversations).toEqual([]);
    expect(s.currentMessages).toEqual([]);
  });
});
