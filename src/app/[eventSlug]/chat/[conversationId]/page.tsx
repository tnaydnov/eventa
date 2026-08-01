'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, useToastStore, useNotificationStore, useChatsStore } from '@/lib/store';
import {
  getConversationById,
  getMessages,
  getMessagesBefore,
  sendMessage,
  deleteMessage,
  uploadChatImage,
  getParticipant,
  blockParticipant,
  markConversationRead,
  getBlockedIds,
} from '@/lib/api';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import MobileGuard from '@/components/MobileGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Message, PublicParticipant, ParticipantPhoto } from '@/lib/database.types';
import { validateImageFile } from '@/lib/validations';
import {
  loadOutbox, addToOutbox, removeFromOutbox, newOutboxKey, type OutboxEntry,
} from '@/lib/chat-outbox';

/** A rendered chat message, optionally carrying a client-only send status. */
type ChatMessage = Message & { _status?: 'sending' | 'failed' };

import ChatHeader from './_components/ChatHeader';
import MessageBubble from './_components/MessageBubble';
import ChatInputBar from './_components/ChatInputBar';
import BlockConfirmDialog from './_components/BlockConfirmDialog';

// ─── Magic-number constants ────────────────────────────
const MESSAGE_PAGE_SIZE = 50;
const LOAD_OLDER_THRESHOLD = 100;
const LONG_PRESS_MS = 600;

export default function ChatRoomPage({
  params,
}: {
  params: Promise<{ eventSlug: string; conversationId: string }>;
}) {
  const { eventSlug, conversationId } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const toast = useToastStore((s) => s.show);

  // Seed from chats store for instant display
  const cachedConv = useChatsStore((s) => s.conversations.find((c) => c.id === conversationId));
  const cachedOther = cachedConv?.otherParticipant ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Composer draft is persisted per conversation (§23.1) so a mid-event reload or an
  // iOS tab-kill never loses a half-typed message. Restored lazily on mount; the effect
  // below keeps localStorage in sync and clears it once the message is sent (text → '').
  const [text, setText] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return window.localStorage.getItem(`chat-draft:${conversationId}`) ?? ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(!cachedOther);
  const [otherUser, setOtherUser] = useState<(PublicParticipant & { photos: ParticipantPhoto[] }) | null>(cachedOther);
  const [showMenu, setShowMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteMenuMsgId, setDeleteMenuMsgId] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullscreenCloseBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Clean up long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // ─── Load older messages (keyset pagination) ──────────────────
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasOlderMessages || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldestTimestamp = messages[0].created_at;
      const container = messagesContainerRef.current;
      const prevScrollHeight = container?.scrollHeight || 0;
      const older = await getMessagesBefore(conversationId, oldestTimestamp, MESSAGE_PAGE_SIZE);
      if (older.length === 0) {
        setHasOlderMessages(false);
      } else {
        setMessages((prev) => [...older, ...prev]);
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch {
      // Silently fail - user can retry via the button
    } finally {
      setLoadingOlder(false);
    }
  };

  // Persist / clear the composer draft as it changes (§23.1). Empty text removes the key.
  useEffect(() => {
    try {
      if (text) window.localStorage.setItem(`chat-draft:${conversationId}`, text);
      else window.localStorage.removeItem(`chat-draft:${conversationId}`);
    } catch { /* private-mode / quota - non-critical */ }
  }, [text, conversationId]);

  // ─── Scroll to bottom only on NEW messages (not history load) ──
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    // Only auto-scroll when messages are appended (count grew), not prepended (history load)
    if (messages.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (prevMsgCountRef.current === 0 && messages.length > 0) {
      // Initial load - scroll to bottom immediately
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // ─── Load conversation + messages ─────────────────────────────
  useEffect(() => {
    async function load() {
      if (!session) return;
      if (!cachedOther) setLoading(true);

      // If we have cached other user, skip the conversation query - just fetch messages
      let otherId: string | null = cachedOther?.id ?? null;

      if (!otherId) {
        const conv = await getConversationById(conversationId);

        if (!conv) {
          toast('השיחה לא נמצאה');
          setLoading(false);
          return;
        }

        otherId =
          conv.a_participant_id === session.participantId
            ? conv.b_participant_id
            : conv.a_participant_id;
      }

      const [msgs, other] = await Promise.all([
        getMessages(conversationId),
        getParticipant(otherId!),
      ]);

      // Preserve any optimistic/outbox temp messages (pending or failed sends) that
      // are not yet on the server, so a refresh mid-send never drops them.
      setMessages((prev) => {
        const ids = new Set(msgs.map((m) => m.id));
        const temps = prev.filter((m) => m.id.startsWith('temp-') && !ids.has(m.id));
        return [...msgs, ...temps];
      });
      if (other) setOtherUser(other);
      setLoading(false);

      markConversationRead(conversationId);
      const resolvedOther = other || cachedOther;
      if (resolvedOther) {
        useNotificationStore.getState().removeGridHighlightByType(resolvedOther.id, 'message');
        useNotificationStore.getState().removeUnreadConvo(conversationId);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, conversationId]);

  // ─── Realtime via Hub ─────────────────────────────────────────
  useRealtimeHub({
    channelKey: `chat-room:${conversationId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        handler: (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_participant_id === session?.participantId && newMsg.type !== 'system') return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_participant_id !== session?.participantId && newMsg.type !== 'system') {
            markConversationRead(conversationId);
            // Clear any grid highlight / unread badge that the global listener may have added
            if (otherUser) {
              useNotificationStore.getState().removeGridHighlightByType(otherUser.id, 'message');
            }
            useNotificationStore.getState().removeUnreadConvo(conversationId);
          }
        },
      },
      {
        binding: { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        handler: (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        },
      },
    ],
    enabled: !!session,
  });

  // ─── Block listener ───────────────────────────────────────────
  useRealtimeHub({
    channelKey: `block-chat:${conversationId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'blocks', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          if (!otherUser || !session) return;
          const block = payload.new as { blocker_id: string; blocked_id: string };
          const involves =
            (block.blocker_id === session.participantId && block.blocked_id === otherUser.id) ||
            (block.blocker_id === otherUser.id && block.blocked_id === session.participantId);
          if (involves) {
            toast('השיחה הוסרה עקב חסימה');
            router.replace(`/${eventSlug}`);
          }
        },
      },
    ],
    enabled: !!session && !!otherUser,
  });

  // ─── Refresh on app resume ────────────────────────────────────
  useAppResume(async () => {
    if (!session) return;
    // Reconcile block status first: a block placed while we were backgrounded would
    // have been missed by the realtime handler (the socket may have been dead). Re-check
    // and redirect out of the conversation if we're now blocked - mirrors the realtime path.
    if (otherUser) {
      const blockedIds = await getBlockedIds(session.eventId, session.participantId);
      if (blockedIds.has(otherUser.id)) {
        toast('השיחה הוסרה עקב חסימה');
        router.replace(`/${eventSlug}`);
        return;
      }
    }
    const fresh = await getMessages(conversationId);
    setMessages((prev) => {
      const ids = new Set(fresh.map((m) => m.id));
      const temps = prev.filter((m) => m.id.startsWith('temp-') && !ids.has(m.id));
      return [...fresh, ...temps];
    });
    // Resend anything still queued in the durable outbox now that we're back.
    flushOutbox();
  }, !!session);

  // ─── Handlers ─────────────────────────────────────────────────

  // Build an optimistic message object from an outbox entry.
  const buildTempMessage = (entry: OutboxEntry, status: 'sending' | 'failed'): ChatMessage => ({
    id: `temp-${entry.key}`,
    event_id: session?.eventId ?? '',
    conversation_id: entry.conversationId,
    sender_participant_id: session?.participantId ?? '',
    type: 'text',
    text: entry.text,
    media_path: null,
    is_deleted: false,
    created_at: new Date(entry.createdAt).toISOString(),
    _status: status,
  });

  // Tracks outbox keys currently being sent, so a flush can't double-fire the same entry.
  const inFlightRef = useRef<Set<string>>(new Set());

  // Send (or resend) a single durable-outbox entry. Reuses the entry's stable
  // idempotency key, so the server dedupes replays - a resend can never duplicate.
  const sendOutboxEntry = useCallback(async (entry: OutboxEntry) => {
    if (inFlightRef.current.has(entry.key)) return;
    inFlightRef.current.add(entry.key);
    const tempId = `temp-${entry.key}`;
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: 'sending' } : m)));
    try {
      const msg = await sendMessage(entry.conversationId, entry.text, 'text', undefined, entry.key);
      if (msg) {
        removeFromOutbox(entry.conversationId, entry.key);
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          // Avoid a duplicate if the realtime INSERT already delivered this row.
          if (withoutTemp.some((m) => m.id === msg.id)) return withoutTemp;
          return [...withoutTemp, msg];
        });
      } else {
        // Keep the message visible as "failed - tap to retry" (never delete the text).
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: 'failed' } : m)));
      }
    } finally {
      inFlightRef.current.delete(entry.key);
    }
  }, [session]);

  // Flush every queued entry - called on mount, on reconnect (`online`), and on resume.
  const flushOutbox = useCallback(() => {
    for (const entry of loadOutbox(conversationId)) {
      void sendOutboxEntry(entry);
    }
  }, [conversationId, sendOutboxEntry]);

  // Retry a single failed message (tap on the "failed" bubble).
  const retryMessage = useCallback((tempId: string) => {
    if (!tempId.startsWith('temp-')) return;
    const key = tempId.slice('temp-'.length);
    const entry = loadOutbox(conversationId).find((e) => e.key === key);
    if (entry) void sendOutboxEntry(entry);
  }, [conversationId, sendOutboxEntry]);

  // Restore any persisted outbox entries on mount as "failed" bubbles, then try to flush
  // them (auto-recover a send that was interrupted by a reload / tab-kill).
  useEffect(() => {
    const entries = loadOutbox(conversationId);
    if (entries.length === 0) return;
    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      const temps = entries
        .filter((e) => !existing.has(`temp-${e.key}`))
        .map((e) => buildTempMessage(e, 'failed'));
      return temps.length ? [...prev, ...temps] : prev;
    });
    flushOutbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Auto-flush the outbox when connectivity returns.
  useEffect(() => {
    const onOnline = () => flushOutbox();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushOutbox]);

  const handleSend = async () => {
    if (!session || !text.trim()) return;
    const msgText = text.trim();
    setText('');

    // Persist to the durable outbox first (survives reload), then optimistically render.
    const key = newOutboxKey();
    const entry: OutboxEntry = { key, conversationId, text: msgText, createdAt: Date.now() };
    addToOutbox(entry);
    setMessages((prev) => [...prev, buildTempMessage(entry, 'sending')]);
    await sendOutboxEntry(entry);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    const imgErr = validateImageFile(file);
    if (imgErr) {
      toast(imgErr);
      e.target.value = '';
      return;
    }

    setSending(true);
    setUploadingImage(true);

    // Yield to the event loop so React can paint the upload spinner
    // before compression blocks the main thread.
    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

    const path = await uploadChatImage(session.eventId, conversationId, file);
    if (path) {
      const msg = await sendMessage(conversationId, '', 'image', path);
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    } else {
      toast('שגיאה בהעלאת התמונה - נסו שוב');
    }
    setSending(false);
    setUploadingImage(false);
    e.target.value = '';
  };

  const handleBlock = async () => {
    if (!session || !otherUser) return;
    const success = await blockParticipant(otherUser.id);
    if (success) {
      toast('המשתמש נחסם');
      router.back();
    } else {
      toast('שגיאה בחסימה - נסו שוב');
    }
  };

  const handleDeleteMsg = async (msgId: string) => {
    const success = await deleteMessage(msgId);
    if (success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, is_deleted: true, text: null, media_path: null } : m))
      );
      toast('ההודעה נמחקה');
    } else {
      toast('שגיאה במחיקת ההודעה - נסו שוב');
    }
    setDeleteMenuMsgId(null);
  };

  const handleMsgTouchStart = (msgId: string, isMine: boolean) => {
    if (!isMine) return;
    longPressTimerRef.current = setTimeout(() => setDeleteMenuMsgId(msgId), LONG_PRESS_MS);
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const dismissMenus = () => {
    setShowMenu(false);
    setDeleteMenuMsgId(null);
  };

  // ─── Escape key to close fullscreen image ──────────────────────
  useEffect(() => {
    if (!fullscreenImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreenImage(null); };
    window.addEventListener('keydown', onKey);
    // Auto-focus close button when viewer opens
    requestAnimationFrame(() => fullscreenCloseBtnRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenImage]);

  // ─── Escape key to close dropdown menu ─────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
    window.addEventListener('keydown', onKey);
    // Auto-focus first menu item
    requestAnimationFrame(() => {
      const firstBtn = menuRef.current?.querySelector<HTMLElement>('button');
      firstBtn?.focus();
    });
    return () => window.removeEventListener('keydown', onKey);
  }, [showMenu]);

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <MobileGuard>
        <LoadingSpinner />
      </MobileGuard>
    );
  }

  return (
    <MobileGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', zIndex: 1 }}>
        <ChatHeader
          otherUser={otherUser}
          onBack={() => router.back()}
          onUserClick={() => otherUser && router.push(`/${eventSlug}/user/${otherUser.id}`)}
          onMenuToggle={() => setShowMenu(!showMenu)}
        />
        <h1 className="sr-only">שיחה עם {otherUser?.display_name || 'משתמש'}</h1>

        {/* Menu dropdown */}
        {showMenu && (
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(60px + env(safe-area-inset-top))',
              left: '16px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              zIndex: 50,
              overflow: 'hidden',
              minWidth: '180px',
            }}
          >
            <button
              role="menuitem"
              onClick={() => {
                setShowMenu(false);
                setShowBlockConfirm(true);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                textAlign: 'start',
                fontSize: '14px',
              }}
            >
              <span aria-hidden="true">🚫 </span>חסום משתמש
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="chat-messages"
          style={{ flex: 1, overflowY: 'auto' }}
          onClick={dismissMenus}
        >
          {hasOlderMessages && messages.length >= LOAD_OLDER_THRESHOLD && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <button
                onClick={loadOlderMessages}
                disabled={loadingOlder}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  cursor: loadingOlder ? 'default' : 'pointer',
                }}
              >
                {loadingOlder ? 'טוען...' : 'טען הודעות ישנות'}
              </button>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={msg.sender_participant_id === session?.participantId}
              deleteMenuMsgId={deleteMenuMsgId}
              onDelete={handleDeleteMsg}
              onTouchStart={handleMsgTouchStart}
              onTouchEnd={handleMsgTouchEnd}
              onShowDeleteMenu={() => setDeleteMenuMsgId(msg.id)}
              onImageClick={setFullscreenImage}
              onRetry={retryMessage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Image uploading indicator */}
        {uploadingImage && (
          <div className="chat-upload-indicator">
            <div className="photo-upload-spinner photo-upload-spinner--sm" />
            <span>מעלה תמונה...</span>
          </div>
        )}

        {/* Input bar */}
        <ChatInputBar
          text={text}
          setText={setText}
          sending={sending}
          onSend={handleSend}
          onImageUpload={handleImageUpload}
          fileInputRef={fileInputRef}
        />
      </div>

      <BlockConfirmDialog
        isOpen={showBlockConfirm}
        displayName={otherUser?.display_name || ''}
        onConfirm={handleBlock}
        onClose={() => setShowBlockConfirm(false)}
      />

      {/* Fullscreen image viewer */}
      {fullscreenImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="תמונה בגודל מלא"
          onClick={() => setFullscreenImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <button
            ref={fullscreenCloseBtnRef}
            onClick={() => setFullscreenImage(null)}
            style={{
              position: 'absolute',
              top: 'max(16px, env(safe-area-inset-top))',
              right: '16px',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 1,
            }}
            aria-label="סגור"
          >
            ✕
          </button>
          <img
            src={fullscreenImage}
            alt="תמונה בגודל מלא"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          />
        </div>
      )}
    </MobileGuard>
  );
}
