'use client';

import React from 'react';
import { CameraIcon } from '@/components/Icons';

interface ChatInputBarProps {
  text: string;
  setText: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function ChatInputBar({
  text,
  setText,
  sending,
  onSend,
  onImageUpload,
  fileInputRef,
}: ChatInputBarProps) {
  return (
    <div className="message-input-bar">
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          background: 'var(--primary)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1a1a1a',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <CameraIcon size={20} color="#1a1a1a" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onImageUpload}
      />
      <input
        placeholder="הקלידו הודעה..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button onClick={onSend} disabled={!text.trim() || sending}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
