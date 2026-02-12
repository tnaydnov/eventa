'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, useToastStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { closeCompass, getParticipant, getPhotoUrl } from '@/lib/api';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { AnimatedOverlay } from '@/components/Animations';
import { COMPASS_TIMEOUT_MS } from '@/lib/constants';
import type { Participant, ParticipantPhoto } from '@/lib/database.types';

interface CompassRequest {
  sessionId: string;
  fromName: string;
  fromId: string;
  fromPhoto: string | null;
}

/**
 * Listens for incoming compass_request notifications and shows
 * an accept/decline dialog with profile preview.
 * Supports a QUEUE of simultaneous requests — when one is
 * accepted/declined, the next automatically pops up.
 * Mounted inside the event layout — works on any page.
 * Auto-expires after 5 minutes.
 */
export default function CompassRequestListener() {
  const session = useSessionStore((s) => s.session);
  const toast = useToastStore((s) => s.show);
  const router = useRouter();
  const [queue, setQueue] = useState<CompassRequest[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const autoDeclineTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Current request is always the first in the queue
  const pending = queue.length > 0 ? queue[0] : null;

  /** Remove a request from the queue by sessionId */
  const removeFromQueue = useCallback((sessionId: string) => {
    setQueue((prev) => prev.filter((r) => r.sessionId !== sessionId));
    // Clear its auto-decline timer
    const timer = autoDeclineTimersRef.current.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      autoDeclineTimersRef.current.delete(sessionId);
    }
  }, []);

  /** Validate the compass session is still pending & not expired, then add to queue */
  const validateAndEnqueue = useCallback(async (sessionId: string, fromId: string) => {
    const { data: cs } = await supabase
      .from('compass_sessions')
      .select('status, created_at')
      .eq('id', sessionId)
      .single();

    if (!cs || cs.status !== 'pending') return;

    const age = Date.now() - new Date(cs.created_at).getTime();
    if (age > COMPASS_TIMEOUT_MS) return; // expired

    const from = await getParticipant(fromId) as (Participant & { photos: ParticipantPhoto[] }) | null;
    if (!from) return;

    const photoPath = from.photos?.length > 0 ? from.photos[0].storage_path : null;

    setQueue((prev) => {
      // Don't add duplicates
      if (prev.some((r) => r.sessionId === sessionId)) return prev;
      return [...prev, { sessionId, fromName: from.display_name, fromId, fromPhoto: photoPath }];
    });
    setMinimized(false); // Show dialog for new requests

    // Start auto-decline timer for remaining time
    const remaining = COMPASS_TIMEOUT_MS - age;
    // Clear existing timer for this session if any
    const existing = autoDeclineTimersRef.current.get(sessionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      closeCompass(sessionId, 'expired');
      removeFromQueue(sessionId);
      toast('🧭 בקשת מצפן פגה');
    }, remaining);
    autoDeclineTimersRef.current.set(sessionId, timer);
  }, [removeFromQueue, toast]);

  // Check on mount — fetch ALL pending compass requests
  useEffect(() => {
    if (!session) return;

    async function checkPending() {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id, payload, created_at')
        .eq('to_participant_id', session!.participantId)
        .eq('type', 'compass_request')
        .eq('is_read', false)
        .order('created_at', { ascending: true });

      if (notifs && notifs.length > 0) {
        for (const n of notifs) {
          const payload = n.payload as { from_participant_id: string; session_id: string };
          await validateAndEnqueue(payload.session_id, payload.from_participant_id);
        }
      }
    }
    checkPending();

    return () => {
      // Clear all timers on unmount
      for (const timer of autoDeclineTimersRef.current.values()) {
        clearTimeout(timer);
      }
      autoDeclineTimersRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Re-check when returning from background
  useAppResume(async () => {
    if (!session) return;
    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, payload, created_at')
      .eq('to_participant_id', session.participantId)
      .eq('type', 'compass_request')
      .eq('is_read', false)
      .order('created_at', { ascending: true });

    if (notifs && notifs.length > 0) {
      for (const n of notifs) {
        const payload = n.payload as { from_participant_id: string; session_id: string };
        // validateAndEnqueue already deduplicates
        await validateAndEnqueue(payload.session_id, payload.from_participant_id);
      }
    }
  }, !!session);

  // Realtime via Hub
  useRealtimeHub({
    channelKey: `compass-notif:${session?.participantId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_participant_id=eq.${session?.participantId}` },
        handler: async (payload) => {
          const notif = payload.new as {
            type: string;
            payload: { from_participant_id: string; session_id: string };
          };
          if (notif.type === 'compass_request') {
            await validateAndEnqueue(notif.payload.session_id, notif.payload.from_participant_id);
          } else if (notif.type === 'compass_cancelled') {
            // Sender cancelled — remove from queue
            const cancelledSessionId = notif.payload.session_id;
            removeFromQueue(cancelledSessionId);
            toast('🧭 בקשת מצפן בוטלה');
          }
        },
      },
    ],
    enabled: !!session,
  });

  const handleAccept = async () => {
    if (!pending || !session || accepting) return;
    setAccepting(true);
    const res = await fetch('/api/secure/compass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', sessionId: pending.sessionId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'EXPIRED') {
        toast('🧭 בקשת המצפן פגה — בקשו אחת חדשה');
      } else {
        toast('שגיאה — נסו שוב');
      }
      removeFromQueue(pending.sessionId);
      setAccepting(false);
      return;
    }

    const sid = pending.sessionId;
    removeFromQueue(sid);
    toast('🧭 מצפן הופעל!');
    setAccepting(false);
    router.push(`/e/${session.eventSlug}/compass/${sid}`);
  };

  const handleDecline = async () => {
    if (!pending || !session) return;
    await closeCompass(pending.sessionId, 'declined');
    removeFromQueue(pending.sessionId);
    toast('בקשת המצפן נדחתה');
  };

  if (queue.length === 0) return null;

  // ─── Floating pill when minimized ───
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, var(--primary) 0%, #9c27b0 100%)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(233,30,99,0.5)',
          animation: 'pulse-badge 2s infinite',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '20px' }}>🧭</span>
        <span>
          {queue.length === 1
            ? `בקשת מצפן מ${pending!.fromName}`
            : `${queue.length} בקשות מצפן`}
        </span>
        {queue.length > 1 && (
          <span style={{
            background: '#fff',
            color: 'var(--primary)',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
          }}>
            {queue.length}
          </span>
        )}
        <span style={{ fontSize: '18px' }}>👆</span>
      </div>
    );
  }

  return (
    <AnimatedOverlay isOpen={!!pending && !minimized} onClose={() => setMinimized(true)}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧭</div>
        <h3 style={{ marginBottom: '8px', color: 'var(--primary)' }}>
          בקשת מצפן מפגש
        </h3>

        {/* Queue indicator */}
        {queue.length > 1 && (
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            marginBottom: '12px',
            background: 'rgba(233,30,99,0.1)',
            borderRadius: '12px',
            padding: '4px 12px',
            display: 'inline-block',
          }}>
            בקשה 1 מתוך {queue.length}
          </p>
        )}

        {/* Profile preview — tap to view full profile */}
        {pending && (
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}
            onClick={() => {
              if (session) {
                setMinimized(true);
                router.push(`/e/${session.eventSlug}/user/${pending.fromId}`);
              }
            }}
          >
            {pending.fromPhoto ? (
              <img
                src={getPhotoUrl(pending.fromPhoto)}
                alt={pending.fromName}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }}
              />
            ) : (
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'var(--surface-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '36px',
              }}>
                👤
              </div>
            )}
            <span style={{ color: 'var(--primary)', fontSize: '13px', textDecoration: 'underline' }}>
              צפייה בפרופיל
            </span>
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '20px', lineHeight: 1.6 }}>
          <strong>{pending?.fromName}</strong> רוצה למצוא אותך!
          <br />
          שיתוף המיקום מוצפן ונשאר בין שניכם בלבד.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={handleAccept} disabled={accepting}>
            {accepting ? '⏳' : '🧭'} בוא/י נמצא!
          </button>
          <button className="btn btn-secondary" onClick={handleDecline}>
            לא עכשיו
          </button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
