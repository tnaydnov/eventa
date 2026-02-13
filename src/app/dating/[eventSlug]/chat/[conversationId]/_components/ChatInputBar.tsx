'use client';

import React from 'react';
import { CameraIcon } from '@/components/Icons';
import { formatDuration } from '../_hooks/useVoiceRecording';
import type { VoiceRecordingState, VoiceRecordingHandlers } from '../_hooks/useVoiceRecording';

interface ChatInputBarProps extends VoiceRecordingState, VoiceRecordingHandlers {
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
  recording,
  recordingLocked,
  recordingCancelled,
  recordingDuration,
  slideOffset,
  sendRecordedAudio,
  cancelRecording,
  handleMicTouchStart,
  handleMicTouchMove,
  handleMicTouchEnd,
  handleMicMouseDown,
  handleMicMouseUp,
}: ChatInputBarProps) {
  if (recording) {
    if (recordingLocked) {
      // Locked mode: show timer + send/delete buttons
      return (
        <div className="message-input-bar">
          <div className="voice-locked-bar">
            <button
              className="voice-locked-delete"
              onClick={cancelRecording}
              aria-label="מחק הקלטה"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
            <div className="voice-locked-timer">
              <div className="voice-rec-dot" />
              {formatDuration(recordingDuration)}
            </div>
            <button
              className="voice-locked-send"
              onClick={() => sendRecordedAudio()}
              aria-label="שלח הקלטה"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      );
    }

    // Holding mode: show slide hints
    return (
      <div className="message-input-bar">
        <div className="voice-recording-bar">
          <div className="voice-slide-hint-cancel" style={{ opacity: slideOffset.x < -40 ? 1 : 0.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={recordingCancelled ? 'var(--danger)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
            <span className="voice-slide-text">
              {recordingCancelled ? 'שחרר לביטול' : '← גרור לביטול'}
            </span>
          </div>
          <div className="voice-timer">
            <div className="voice-rec-dot" />
            {formatDuration(recordingDuration)}
          </div>
          <div className="voice-lock-hint" style={{ opacity: slideOffset.y < -30 ? 1 : 0.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ─── Normal input bar ────────────────────────
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
      <button
        className="voice-mic-btn"
        onTouchStart={handleMicTouchStart}
        onTouchMove={handleMicTouchMove}
        onTouchEnd={handleMicTouchEnd}
        onMouseDown={handleMicMouseDown}
        onMouseUp={handleMicMouseUp}
        onMouseLeave={() => {
          if (recording) sendRecordedAudio();
        }}
        aria-label="החזק להקלטה"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      <button onClick={onSend} disabled={!text.trim() || sending}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
