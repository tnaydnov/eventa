'use client';

import { use, useEffect, useState, useCallback, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, useChatsStore } from '@/lib/store';
import { getConversations, getPhotoUrl } from '@/lib/api';
import { SWR_STALE_MS } from '@/lib/constants';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import AppHeader from '@/components/AppHeader';
import TabBar from '@/components/TabBar';
import Toast from '@/components/Toast';
import { ChatsSkeleton } from '@/components/Skeletons';
import Image from 'next/image';
import { ChatBubbleIcon, UserIcon } from '@/components/Icons';
import type { ConversationWithDetails } from '@/lib/stores/chats';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} שע׳`;
  return `${Math.floor(hours / 24)} ימים`;
}

/** Memoized chat list item - only re-renders when conversation data changes. */
const ChatListItem = memo(function ChatListItem({
  conv,
  onClick,
}: {
  conv: ConversationWithDetails;
  onClick: (convId: string) => void;
}) {
  const other = conv.otherParticipant;
  const photoUrl = other.photos.length > 0 ? getPhotoUrl(other.photos[0].storage_path) : null;
  const hasUnread = conv.unreadCount > 0;
  return (
    <div className="chat-list-item" onClick={() => onClick(conv.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(conv.id); } }} role="button" tabIndex={0} aria-label={`שיחה עם ${other.display_name}`}>
      {photoUrl ? (
        <Image src={photoUrl} alt={other.display_name} className="chat-avatar" width={48} height={48} />
      ) : (
        <div className="chat-avatar chat-avatar-placeholder"><UserIcon size={20} /></div>
      )}
      <div className="chat-info">
        <div className={`chat-name${hasUnread ? ' chat-name--unread' : ''}`}>{other.display_name}</div>
        <div className={`chat-last-msg${hasUnread ? ' chat-last-msg--unread' : ''}`}>{conv.lastMessageText || 'שיחה חדשה'}</div>
      </div>
      <div className="chat-meta">
        <div className="chat-time">{timeAgo(conv.last_message_at || conv.created_at)}</div>
        {hasUnread && (
          <span className="unread-badge">{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>
        )}
      </div>
    </div>
  );
});

export default function ChatsPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const conversations = useChatsStore((s) => s.conversations);
  const setConversations = useChatsStore((s) => s.setConversations);
  const updateConversationPreview = useChatsStore((s) => s.updateConversationPreview);
  const removeConversation = useChatsStore((s) => s.removeConversation);
  // Stale-while-revalidate: only show spinner on first-ever load
  const [loading, setLoading] = useState(conversations.length === 0);
  const lastFetchRef = useRef(0);

  const loadChats = useCallback(async () => {
    const s = useSessionStore.getState().session;
    if (!s) return;
    try {
      const data = await getConversations(s.eventId, s.participantId);
      setConversations(data);
      lastFetchRef.current = Date.now();
    } catch {
      // Silently fail - stale data is better than a stuck spinner
    } finally {
      setLoading(false);
    }
  }, [setConversations]);

  useEffect(() => {
    if (Date.now() - lastFetchRef.current < SWR_STALE_MS) return;
    loadChats();
  }, [loadChats, session]);

  // Reload chats when user returns from background
  useAppResume(() => loadChats(), !!session);

  // Realtime via Hub - local updates where possible, full reload as fallback
  useRealtimeHub({
    channelKey: `chats-live:${session?.eventId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'conversations', filter: `event_id=eq.${session?.eventId}` },
        handler: () => loadChats(), // New conversation → full reload (need participant data)
      },
      {
        binding: { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const msg = payload.new as { conversation_id: string; sender_participant_id: string; text: string | null; type: string; created_at: string };
          // Only care about messages in conversations I'm part of
          const conv = useChatsStore.getState().conversations.find((c) => c.id === msg.conversation_id);
          if (!conv) {
            // Could be a new conversation - reload
            loadChats();
            return;
          }
          const preview = msg.type === 'text' ? (msg.text || '') : msg.type === 'image' ? '📷 תמונה' : (msg.text || '');
          const isFromOther = msg.sender_participant_id !== session?.participantId;
          updateConversationPreview(msg.conversation_id, preview, msg.created_at, isFromOther);
        },
      },
      {
        binding: { event: 'INSERT', schema: 'public', table: 'blocks', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const block = payload.new as { blocker_id: string; blocked_id: string };
          if (block.blocker_id === session?.participantId || block.blocked_id === session?.participantId) {
            // Remove conversations with blocked user
            const otherId = block.blocker_id === session?.participantId ? block.blocked_id : block.blocker_id;
            const convs = useChatsStore.getState().conversations;
            for (const c of convs) {
              if (c.otherParticipant.id === otherId) {
                removeConversation(c.id);
              }
            }
          }
        },
      },
    ],
    enabled: !!session,
  });

  // Stable callback for chat list item clicks - avoids re-creating closures per item
  const handleChatClick = useCallback((convId: string) => {
    router.push(`/dating/${eventSlug}/chat/${convId}`);
  }, [router, eventSlug]);

  // Realtime via Hub handles live updates; useAppResume handles returning from background.
  // No additional polling needed - RealtimeNotificationListener provides global fallback.

  return (
    <MobileGuard>
      <PageTransition>
        <div className="app-container">
          <AppHeader />
          <div className="main-content">
            {loading ? (
              <ChatsSkeleton />
            ) : conversations.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--foreground)' }}>
                <div style={{ marginBottom: '16px', opacity: 0.8 }}><ChatBubbleIcon size={48} color="var(--primary)" /></div>
                <p style={{ fontSize: '16px', fontWeight: 500 }}>אין שיחות עדיין</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>לחצו על פרופיל כדי לשלוח הודעה ראשונה</p>
              </div>
            ) : (
              <div role="list" aria-label="רשימת שיחות">
                <StaggerContainer>
                  {conversations.map((conv) => (
                      <StaggerItem key={conv.id}>
                        <div role="listitem">
                          <ChatListItem conv={conv} onClick={handleChatClick} />
                        </div>
                      </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            )}
          </div>
          <TabBar />
          <Toast />
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
