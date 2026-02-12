import { create } from 'zustand';
import type { Conversation, Participant, ParticipantPhoto, Message } from '../database.types';

export interface ConversationWithDetails extends Conversation {
  otherParticipant: Participant & { photos: ParticipantPhoto[] };
  lastMessageText?: string;
  unreadCount: number;
}

interface ChatsState {
  conversations: ConversationWithDetails[];
  currentMessages: Message[];
  setConversations: (c: ConversationWithDetails[]) => void;
  addMessage: (m: Message) => void;
  setCurrentMessages: (msgs: Message[]) => void;
  removeConversation: (id: string) => void;
  /** Update a conversation's preview text, unread count, and sort to top */
  updateConversationPreview: (conversationId: string, text: string, time: string, incrementUnread: boolean) => void;
}

export const useChatsStore = create<ChatsState>((set) => ({
  conversations: [],
  currentMessages: [],
  setConversations: (conversations) => set({ conversations }),
  addMessage: (m) =>
    set((s) => ({ currentMessages: [...s.currentMessages, m] })),
  setCurrentMessages: (currentMessages) => set({ currentMessages }),
  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
    })),
  updateConversationPreview: (conversationId, text, time, incrementUnread) =>
    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessageText: text,
              last_message_at: time,
              unreadCount: incrementUnread ? c.unreadCount + 1 : c.unreadCount,
            }
          : c
      );
      // Sort by last_message_at descending (most recent first)
      updated.sort((a, b) => (b.last_message_at || b.created_at).localeCompare(a.last_message_at || a.created_at));
      return { conversations: updated };
    }),
}));
