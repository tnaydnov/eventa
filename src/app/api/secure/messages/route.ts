import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isValidUUID } from '@/lib/session';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sendMessageSchema, messageTypeValues } from '@/lib/validations';
import { MAX_MESSAGE_LENGTH } from '@/lib/constants';
import { secureGuard, jsonError, isSafePath } from '@/lib/route-helpers';

/** Allowed message types for validation. */
const ALLOWED_TYPES = new Set<string>(messageTypeValues);

/**
 * POST /api/secure/messages — Send a message.
 * Guards: conversation membership, block check, Zod validation.
 */
export async function POST(req: NextRequest) {
  const guard = await secureGuard(req, 'msg', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId || !isValidUUID(conversationId)) {
      return jsonError('Invalid conversation', 400);
    }

    // Validate message fields with Zod
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid message data', 400);
    }

    const { text, type, mediaPath } = parsed.data;

    // Extra guard: reject unknown types that somehow pass Zod
    if (!ALLOWED_TYPES.has(type)) {
      return jsonError('Invalid message type', 400);
    }

    const supabase = getServiceClient();

    // Verify sender is part of this conversation AND conversation belongs to this event
    const { data: conv } = await supabase
      .from('conversations')
      .select('a_participant_id, b_participant_id')
      .eq('id', conversationId)
      .eq('event_id', session.eid)
      .single();

    if (!conv || (conv.a_participant_id !== session.sub && conv.b_participant_id !== session.sub)) {
      return jsonError('Forbidden', 403);
    }

    // Block check — refuse message if either party blocked the other
    const recipientId =
      conv.a_participant_id === session.sub ? conv.b_participant_id : conv.a_participant_id;

    const { count: blockCount } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', session.eid)
      .or(
        `and(blocker_id.eq.${session.sub},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${session.sub})`
      );

    if ((blockCount ?? 0) > 0) {
      return jsonError('Cannot send message — user is blocked', 403);
    }

    // Guard: text-type messages must have non-empty text
    if (type === 'text' && (!text || text.trim().length === 0)) {
      return jsonError('Text message cannot be empty', 400);
    }

    // Validate mediaPath ownership when type is image/audio
    if ((type === 'image' || type === 'audio') && mediaPath) {
      if (!isSafePath(mediaPath)) {
        return jsonError('Invalid media path', 400);
      }
      const isOwnPath =
        mediaPath.startsWith(`chat/${session.eid}/`) ||
        mediaPath.startsWith(`${session.eid}/${session.sub}/`);
      if (!isOwnPath) {
        return jsonError('Invalid media path', 400);
      }
    }

    const cleanText = type === 'text' ? sanitizeWithLimit(text || '', MAX_MESSAGE_LENGTH) : null;

    // Update last_message_at BEFORE inserting the message so that when the
    // realtime INSERT event fires, the conversation is already visible
    // (last_message_at != NULL) in the other user's chat list query.
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        event_id: session.eid,
        conversation_id: conversationId,
        sender_participant_id: session.sub,
        type,
        text: cleanText,
        media_path: mediaPath || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[MESSAGES_POST] insert error:', error);
      return jsonError('Failed to send message', 400);
    }

    // Activity log + notification (fire-and-forget / parallel)
    supabase.from('activity_log').insert({
      event_id: session.eid,
      participant_id: session.sub,
      action: 'message',
    }).then();

    supabase.from('notifications').insert({
      event_id: session.eid,
      to_participant_id: recipientId,
      type: 'new_message',
      payload: { from_participant_id: session.sub, conversation_id: conversationId },
      is_read: false,
    }).then();

    return NextResponse.json(data);
  } catch (err) {
    console.error('[MESSAGES_POST] error:', err);
    return jsonError('Server error', 500);
  }
}

/**
 * PATCH /api/secure/messages — Soft-delete a message (sender only).
 * Clears text and media_path, sets is_deleted flag.
 */
export async function PATCH(req: NextRequest) {
  const guard = await secureGuard(req, 'msg-del', RATE_LIMITS.standard);
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  try {
    const { messageId } = await req.json();
    if (!messageId || !isValidUUID(messageId)) {
      return jsonError('Invalid message', 400);
    }

    const supabase = getServiceClient();

    // Verify message exists, belongs to this event, and belongs to the sender
    const { data: msg } = await supabase
      .from('messages')
      .select('sender_participant_id')
      .eq('id', messageId)
      .eq('event_id', session.eid)
      .single();

    if (!msg) return jsonError('Message not found', 404);
    if (msg.sender_participant_id !== session.sub) {
      return jsonError('Forbidden — can only delete your own messages', 403);
    }

    // Soft delete
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, text: null, media_path: null })
      .eq('id', messageId);

    if (error) {
      console.error('[MESSAGES_DELETE] error:', error);
      return jsonError('Failed to delete message', 400);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[MESSAGES_DELETE] error:', err);
    return jsonError('Server error', 500);
  }
}
