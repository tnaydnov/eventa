'use client';

import React from 'react';
import { getPhotoUrl } from '@/lib/api';
import type { Message } from '@/lib/database.types';

interface MessageBubbleProps {
  msg: Message;
  isMine: boolean;
  deleteMenuMsgId: string | null;
  onDelete: (msgId: string) => void;
  onTouchStart: (msgId: string, isMine: boolean) => void;
  onTouchEnd: () => void;
  onShowDeleteMenu: () => void;
  onImageClick?: (src: string) => void;
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
              const imgUrl = getPhotoUrl(msg.media_path!);
              return (
                <img
                  src={imgUrl}
                  alt="תמונה"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageClick?.(imgUrl);
                  }}
                  style={{
                    maxWidth: '200px',
                    borderRadius: '8px',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                  loading="lazy"
                />
              );
            })()}
          </>
        )}
      </div>
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
