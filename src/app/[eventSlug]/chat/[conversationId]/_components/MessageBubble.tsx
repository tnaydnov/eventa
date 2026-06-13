'use client';

import React from 'react';
import Image from 'next/image';
import { getPhotoUrl } from '@/lib/api';
import { PHOTO_BLUR_DATA_URL } from '@/lib/image-placeholder';
import type { Message } from '@/lib/database.types';

/** A rendered message, optionally carrying a client-only send status (outbox). */
type ChatMessage = Message & { _status?: 'sending' | 'failed' };

interface MessageBubbleProps {
  msg: ChatMessage;
  isMine: boolean;
  deleteMenuMsgId: string | null;
  onDelete: (msgId: string) => void;
  onTouchStart: (msgId: string, isMine: boolean) => void;
  onTouchEnd: () => void;
  onShowDeleteMenu: () => void;
  onImageClick?: (src: string) => void;
  /** Retry a failed (outbox) message; receives the temp message id. */
  onRetry?: (msgId: string) => void;
}

function MessageBubbleInner({
  msg,
  isMine,
  deleteMenuMsgId,
  onDelete,
  onTouchStart,
  onTouchEnd,
  onShowDeleteMenu,
  onImageClick,
  onRetry,
}: MessageBubbleProps) {
  const isSystem = msg.type === 'system';

  // System messages: centered, no bubble
  if (isSystem) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 16px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.05)',
            padding: '6px 14px',
            borderRadius: '12px',
            textAlign: 'center',
            maxWidth: '85%',
          }}
        >
          {msg.text}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
      }}
      onTouchStart={() => onTouchStart(msg.id, isMine)}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={(e) => {
        if (isMine && !msg.is_deleted) {
          e.preventDefault();
          onShowDeleteMenu();
        }
      }}
    >
      <div className={`message-bubble ${isMine ? 'sent' : 'received'}`}>
        {msg.is_deleted ? (
          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px' }}>
            🗑 ההודעה נמחקה
          </span>
        ) : (
          <>
            {msg.type === 'text' && msg.text}
            {msg.type === 'image' && msg.media_path && (() => {
              const imgUrl = getPhotoUrl(msg.media_path!, { width: 600, height: 900, quality: 80 });
              return (
                <Image
                  src={imgUrl}
                  alt="תמונה"
                  width={200}
                  height={300}
                  placeholder="blur"
                  blurDataURL={PHOTO_BLUR_DATA_URL}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageClick?.(imgUrl);
                  }}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxWidth: '200px',
                    borderRadius: '8px',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                />
              );
            })()}
          </>
        )}
      </div>
      {/* Send status (own outbox messages only): pending or failed → tap to retry. */}
      {isMine && msg._status === 'sending' && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 4px 0' }}>
          שולח…
        </span>
      )}
      {isMine && msg._status === 'failed' && (
        <button
          onClick={(e) => { e.stopPropagation(); onRetry?.(msg.id); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            margin: '2px 4px 0',
            padding: 0,
            whiteSpace: 'nowrap',
          }}
        >
          לא נשלח · הקש לשליחה חוזרת
        </button>
      )}
      {/* Delete popup */}
      {deleteMenuMsgId === msg.id && isMine && !msg.is_deleted && (
        <div
          style={{
            position: 'absolute',
            top: '-36px',
            [isMine ? 'left' : 'right']: '8px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            zIndex: 50,
            padding: '6px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(msg.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            🗑 מחק הודעה
          </button>
        </div>
      )}
    </div>
  );
}

const MessageBubble = React.memo(MessageBubbleInner);
export default MessageBubble;
