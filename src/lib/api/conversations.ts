import { supabase } from '../supabase';
import type { Conversation, Message } from '../database.types';
import type { ConversationWithDetails } from '../store';
import { compressChatImage } from '../image-compression';
import { validateImageMagicBytes, getEffectiveImageType } from '../validations';
import { getBlockedIds, buildParticipantPhotoMaps, CONVERSATION_COLUMNS, MESSAGE_COLUMNS } from './helpers';
import { fetchWithRetry } from './fetch-retry';

/** Fetch a single conversation by ID (returns null if not found). */
export async function getConversationById(
  conversationId: string
): Promise<{ id: string; event_id: string; a_participant_id: string; b_participant_id: string; created_at: string; last_message_at: string | null; a_last_read_at: string | null; b_last_read_at: string | null } | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', conversationId)
    .single();
  if (error) console.error('[getConversationById] query error:', error.message);
  return data;
}

/** Get or create a conversation with another participant. */
export async function getOrCreateConversation(
  otherId: string
): Promise<Conversation | null> {
  const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const res = await fetchWithRetry(
      '/api/secure/conversations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ otherId }),
      },
      // Safe to retry: server is race-safe and returns existing conversation when present.
      { retryOnMutations: true },
    );
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('[getOrCreateConversation] error:', err);
    return null;
  }
}

/** List all conversations for the current user (with unread counts). */
export async function getConversations(
  eventId: string,
  myId: string
): Promise<ConversationWithDetails[]> {
  const blockedIds = await getBlockedIds(eventId, myId);

  const { data: convos, error: convosErr } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('event_id', eventId)
    .or(`a_participant_id.eq.${myId},b_participant_id.eq.${myId}`)
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false })
    .limit(50);

  if (convosErr) {
    console.error('[getConversations] query error:', convosErr.message);
  }

  if (!convos) return [];

  const filtered = convos.filter((c) => {
    const otherId =
      c.a_participant_id === myId ? c.b_participant_id : c.a_participant_id;
    return !blockedIds.has(otherId);
  });

  // Fetch other participants
  const otherIds = filtered.map((c) =>
    c.a_participant_id === myId ? c.b_participant_id : c.a_participant_id
  );
  if (otherIds.length === 0) return [];

  const convoIds = filtered.map((c) => c.id);

  // Fire all three independent queries in parallel
  const [{ pMap, phMap }, lastMsgsRes, unreadResult] = await Promise.all([
    buildParticipantPhotoMaps(otherIds),
    supabase
      .from('messages')
      .select('conversation_id, text, type')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false })
      .limit(convoIds.length * 2 || 100),
    // Unread count - single query, partition client-side
    (async () => {
      const { data: unreadRows, error: unreadErr } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convoIds)
        .neq('sender_participant_id', myId)
        .neq('type', 'system');
      if (unreadErr) console.error('[getConversations] unread query error:', unreadErr.message);
      const lastReadMap = new Map<string, string | null>();
      for (const c of filtered) {
        const amA = c.a_participant_id === myId;
        lastReadMap.set(c.id, amA ? c.a_last_read_at : c.b_last_read_at);
      }
      const countMap = new Map<string, number>();
      for (const m of unreadRows || []) {
        const lastRead = lastReadMap.get(m.conversation_id);
        if (lastRead && m.created_at <= lastRead) continue;
        countMap.set(m.conversation_id, (countMap.get(m.conversation_id) || 0) + 1);
      }
      return countMap;
    })(),
  ]);

  if (lastMsgsRes.error) console.error('[getConversations] lastMsgs query error:', lastMsgsRes.error.message);
  const lastMsgs = lastMsgsRes.data;

  const lastMsgMap = new Map<string, string>();
  (lastMsgs || []).forEach((m) => {
    if (!lastMsgMap.has(m.conversation_id)) {
      lastMsgMap.set(
        m.conversation_id,
        m.type === 'text' ? m.text || '' : m.type === 'image' ? '📷 תמונה' : m.text || ''
      );
    }
  });

  return filtered
    .map((c) => {
      const otherId =
        c.a_participant_id === myId ? c.b_participant_id : c.a_participant_id;
      const otherP = pMap.get(otherId);
      if (!otherP) return null;
      return {
        ...c,
        otherParticipant: {
          ...otherP,
          photos: phMap.get(otherId) || [],
        },
        lastMessageText: lastMsgMap.get(c.id),
        unreadCount: unreadResult.get(c.id) || 0,
      };
    })
    .filter(Boolean) as ConversationWithDetails[];
}

/** Fetch messages for a conversation (newest first, reversed for display). */
export async function getMessages(
  conversationId: string,
  limit = 100
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[getMessages] query error:', error.message);
  // Reverse to show oldest first in UI
  return (data || []).reverse();
}

/**
 * Keyset pagination: fetch messages OLDER than a given cursor timestamp.
 * Returns messages in chronological order (oldest→newest) for prepending.
 */
export async function getMessagesBefore(
  conversationId: string,
  beforeTimestamp: string,
  limit = 50
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .lt('created_at', beforeTimestamp)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[getMessagesBefore] query error:', error.message);
  return (data || []).reverse();
}

/** Send a text / image message.
 * An Idempotency-Key header is generated per call so that network retries
 * do not create duplicate messages. The server deduplicates by this key. */
export async function sendMessage(
  conversationId: string,
  text: string,
  type: 'text' | 'image' = 'text',
  mediaPath?: string
): Promise<Message | null> {
  // Generate a per-call idempotency key to prevent duplicate messages on retry
  const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const res = await fetchWithRetry(
      '/api/secure/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ conversationId, text, type, mediaPath }),
      },
      // Safe to retry: server deduplicates by idempotency key.
      { retryOnMutations: true },
    );
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('[sendMessage] error:', err);
    return null;
  }
}

/** Soft-delete a message. */
export async function deleteMessage(messageId: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      '/api/secure/messages',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      },
      // PATCH is idempotent for this operation (soft delete to same state).
      { retryOnMutations: true },
    );
    return res.ok;
  } catch (err) {
    console.error('[deleteMessage] error:', err);
    return false;
  }
}

/** Upload a chat image (validate → compress → sign → upload, return storage path). */
export async function uploadChatImage(
  eventId: string,
  conversationId: string,
  file: File
): Promise<string | null> {
  // Magic byte validation - don't block on mismatch.
  // Chat images may come from camera captures with non-standard headers.
  const effectiveType = getEffectiveImageType(file);
  try {
    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    validateImageMagicBytes(headerBytes, effectiveType);
  } catch { /* proceed - user-selected files are validated by type */ }

  let compressed: File;
  try {
    compressed = await compressChatImage(file);
  } catch (err) {
    console.error('[uploadChatImage] compression failed:', err);
    return null;
  }
  const ext = compressed.name.split('.').pop() || 'webp';
  const path = `chat/${eventId}/${conversationId}/${Date.now()}.${ext}`;

  try {
    const urlRes = await fetch('/api/secure/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!urlRes.ok) {
      console.error('[uploadChatImage] upload-url failed:', urlRes.status);
      return null;
    }
    const { token } = await urlRes.json();

    const { error } = await supabase.storage
      .from('photos')
      .uploadToSignedUrl(path, token, compressed);
    if (error) {
      console.error('[uploadChatImage] storage upload error:', error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.error('[uploadChatImage] upload error:', err);
    return null;
  }
}

/** Mark a conversation as read. */
export async function markConversationRead(conversationId: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      '/api/secure/conversations/read',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      },
      // Read receipt updates to "now" are safe to retry.
      { retryOnMutations: true },
    );
    return res.ok;
  } catch (err) {
    console.error('[markConversationRead] error:', err);
    return false;
  }
}

/** Get all conversations with unread messages. */
export async function getUnreadConversations(
  eventId: string,
  myId: string
): Promise<{ conversationId: string; otherParticipantId: string; count: number }[]> {
  const { data: convos } = await supabase
    .from('conversations')
    .select('id, a_participant_id, b_participant_id, a_last_read_at, b_last_read_at')
    .eq('event_id', eventId)
    .or(`a_participant_id.eq.${myId},b_participant_id.eq.${myId}`);

  if (!convos || convos.length === 0) return [];

  const convoIds = convos.map((c) => c.id);

  // Single batch query - select only conversation_id to minimize transfer
  const { data: unreadMsgs } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .in('conversation_id', convoIds)
    .neq('sender_participant_id', myId)
    .neq('type', 'system');

  // Build per-conversation lastRead map
  const lastReadMap = new Map<string, string | null>();
  for (const c of convos) {
    const amA = c.a_participant_id === myId;
    lastReadMap.set(c.id, amA ? c.a_last_read_at : c.b_last_read_at);
  }

  // Count per conversation
  const countMap = new Map<string, number>();
  for (const m of unreadMsgs || []) {
    const lastRead = lastReadMap.get(m.conversation_id);
    if (lastRead && m.created_at <= lastRead) continue;
    countMap.set(m.conversation_id, (countMap.get(m.conversation_id) || 0) + 1);
  }

  return convos
    .filter((c) => (countMap.get(c.id) || 0) > 0)
    .map((c) => {
      const amA = c.a_participant_id === myId;
      return {
        conversationId: c.id,
        otherParticipantId: amA ? c.b_participant_id : c.a_participant_id,
        count: countMap.get(c.id) || 0,
      };
    });
}
