'use client';

import { useState, useRef } from 'react';
import {
  sendMessage,
  uploadVoiceMessage,
} from '@/lib/api';
import type { Message } from '@/lib/database.types';
import type { WeddingSession } from '@/lib/store';

/** Maximum recording duration in seconds (2 minutes). */
const MAX_RECORDING_DURATION = 120;

/** Format seconds into m:ss display. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface UseVoiceRecordingOptions {
  session: WeddingSession | null;
  conversationId: string;
  toast: (msg: string, duration?: number) => void;
  onMessageSent: (msg: Message) => void;
  setSending: (v: boolean) => void;
}

export interface VoiceRecordingState {
  recording: boolean;
  recordingLocked: boolean;
  recordingCancelled: boolean;
  recordingDuration: number;
  slideOffset: { x: number; y: number };
}

export interface VoiceRecordingHandlers {
  sendRecordedAudio: () => Promise<void>;
  cancelRecording: () => void;
  handleMicTouchStart: (e: React.TouchEvent) => void;
  handleMicTouchMove: (e: React.TouchEvent) => void;
  handleMicTouchEnd: () => void;
  handleMicMouseDown: () => void;
  handleMicMouseUp: () => void;
  handleMicMouseLeave: () => void;
}

export function useVoiceRecording({
  session,
  conversationId,
  toast,
  onMessageSent,
  setSending,
}: UseVoiceRecordingOptions): VoiceRecordingState & VoiceRecordingHandlers {
  const [recording, setRecording] = useState(false);
  const [recordingLocked, setRecordingLocked] = useState(false);
  const [recordingCancelled, setRecordingCancelled] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [slideOffset, setSlideOffset] = useState({ x: 0, y: 0 });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const recordingLockedRef = useRef(false);
  const recordingCancelledRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks whether the finger/mouse is currently held down on the mic button */
  const isHoldingRef = useRef(false);

  const cleanupRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    touchStartRef.current = null;
    recordingLockedRef.current = false;
    recordingCancelledRef.current = false;
    isHoldingRef.current = false;
    setRecording(false);
    setRecordingLocked(false);
    setRecordingCancelled(false);
    setRecordingDuration(0);
    setSlideOffset({ x: 0, y: 0 });
  };

  const sendRecordedAudio = async () => {
    if (!mediaRecorderRef.current || !session) return;
    const recorder = mediaRecorderRef.current;
    const mimeType = recorder.mimeType;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          toast('ההקלטה קצרה מדי');
          cleanupRecording();
          resolve();
          return;
        }

        setSending(true);
        const path = await uploadVoiceMessage(session.eventId, conversationId, blob);
        if (path) {
          const msg = await sendMessage(
            conversationId,
            '',
            'audio',
            path
          );
          if (msg) {
            onMessageSent(msg);
          }
        } else {
          toast('שגיאה בשליחת ההקלטה — נסו שוב');
        }
        setSending(false);
        cleanupRecording();
        resolve();
      };
      if (recorder.state === 'recording') {
        recorder.stop();
      } else {
        cleanupRecording();
        resolve();
      }
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(250);
      setRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);

      // If finger/mouse already lifted before getUserMedia resolved,
      // go straight to locked mode so user has send/cancel buttons.
      if (!isHoldingRef.current) {
        recordingLockedRef.current = true;
        setRecordingLocked(true);
      }

      // Auto-send after max duration to prevent huge files
      maxDurationTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          recordingLockedRef.current = true;
          setRecordingLocked(true);
          sendRecordedAudio();
        }
      }, MAX_RECORDING_DURATION * 1000);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          toast('גישה למיקרופון נדחתה — יש לאשר הרשאות בהגדרות המכשיר');
        } else if (err.name === 'NotFoundError') {
          toast('לא נמצא מיקרופון במכשיר');
        } else {
          toast('שגיאה בהפעלת המיקרופון');
        }
      } else {
        toast('לא ניתן לגשת למיקרופון — יש לאשר הרשאות');
      }
    }
  };

  // ─── Touch gesture handlers ─────────────────────────────────

  const handleMicTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    recordingLockedRef.current = false;
    recordingCancelledRef.current = false;
    isHoldingRef.current = true;
    setSlideOffset({ x: 0, y: 0 });
    startRecording();
  };

  const handleMicTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !recording || recordingLockedRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    setSlideOffset({ x: dx, y: dy });

    if (dx < -100) {
      recordingCancelledRef.current = true;
      setRecordingCancelled(true);
    } else {
      if (recordingCancelledRef.current) {
        recordingCancelledRef.current = false;
        setRecordingCancelled(false);
      }
    }

    if (dy < -80 && !recordingCancelledRef.current) {
      recordingLockedRef.current = true;
      setRecordingLocked(true);
      setSlideOffset({ x: 0, y: 0 });
    }
  };

  const handleMicTouchEnd = () => {
    isHoldingRef.current = false;
    if (!recording) return;
    touchStartRef.current = null;

    if (recordingCancelledRef.current) {
      cancelRecording();
      return;
    }

    if (recordingLockedRef.current) return;

    sendRecordedAudio();
  };

  // ─── Mouse fallback for desktop testing ─────────────────────

  const handleMicMouseDown = () => {
    isHoldingRef.current = true;
    startRecording();
  };

  const handleMicMouseUp = () => {
    isHoldingRef.current = false;
    if (!recording) return;
    if (recordingLockedRef.current) return;
    sendRecordedAudio();
  };

  const handleMicMouseLeave = () => {
    isHoldingRef.current = false;
    if (!recording) return;
    if (recordingLockedRef.current) return;
    sendRecordedAudio();
  };

  return {
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
    handleMicMouseLeave,
  };
}
