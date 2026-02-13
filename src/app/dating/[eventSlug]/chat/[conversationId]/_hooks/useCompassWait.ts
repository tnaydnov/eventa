'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { closeCompass, checkCompassEligible } from '@/lib/api';
import { COMPASS_TIMEOUT_MS } from '@/lib/constants';
import type { WeddingSession } from '@/lib/store';
import type { Participant, ParticipantPhoto } from '@/lib/database.types';

type OtherUser = (Participant & { photos: ParticipantPhoto[] }) | null;

interface UseCompassWaitOptions {
  session: WeddingSession | null;
  otherUser: OtherUser;
  eventSlug: string;
  toast: (msg: string, duration?: number) => void;
}

export interface CompassWaitState {
  compassWaiting: boolean;
  compassEligible: boolean | null;
}

export interface CompassWaitHandlers {
  handleCompassRequest: () => Promise<void>;
  cancelCompassWait: () => Promise<void>;
  refreshEligibility: (otherId: string) => void;
}

export function useCompassWait({
  session,
  otherUser,
  eventSlug,
  toast,
}: UseCompassWaitOptions): CompassWaitState & CompassWaitHandlers {
  const router = useRouter();
  const [compassWaiting, setCompassWaiting] = useState(false);
  const [compassEligible, setCompassEligible] = useState<boolean | null>(null);
  // Track the active compass session ID for dynamic compass-wait subscription
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const compassSessionIdRef = useRef<string | null>(null);
  const compassTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Shared compass cleanup helper ─────────────────────────
  const cleanupCompassState = useCallback(() => {
    if (compassTimerRef.current) {
      clearTimeout(compassTimerRef.current);
      compassTimerRef.current = null;
    }
    compassSessionIdRef.current = null;
    setActiveSessionId(null);
    setCompassWaiting(false);
  }, []);

  // ─── Listen for compass_declined notification via RealtimeHub ──
  useRealtimeHub({
    channelKey: `compass-decline-notif:${session?.participantId}`,
    postgres: [
      {
        binding: {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `to_participant_id=eq.${session?.participantId}`,
        },
        handler: (payload) => {
          const notif = payload.new as { type: string; payload: { session_id: string } };
          if (
            notif.type === 'compass_declined' &&
            notif.payload.session_id === compassSessionIdRef.current
          ) {
            cleanupCompassState();
            toast(`🧭 ${otherUser?.display_name || 'הצד השני'} דחה/תה את בקשת המצפן`, 5000);
          }
        },
      },
    ],
    enabled: !!session,
  });

  // ─── Listen for compass session activation (dynamic) ──────────
  useRealtimeHub({
    channelKey: `compass-wait:${activeSessionId}`,
    postgres: [
      {
        binding: {
          event: 'UPDATE',
          schema: 'public',
          table: 'compass_sessions',
          filter: `id=eq.${activeSessionId}`,
        },
        handler: (payload) => {
          const updated = payload.new as { status: string };
          if (updated.status === 'active') {
            const csId = activeSessionId;
            cleanupCompassState();
            toast('🧭 המצפן הופעל!');
            router.push(`/dating/${eventSlug}/compass/${csId}`);
          } else if (updated.status === 'closed') {
            cleanupCompassState();
            toast(`🧭 ${otherUser?.display_name || 'הצד השני'} דחה/תה את בקשת המצפן`, 5000);
          }
        },
      },
    ],
    enabled: !!activeSessionId,
  });

  // ─── Request compass ──────────────────────────────────────
  const handleCompassRequest = async () => {
    if (!session || !otherUser) return;

    const res = await fetch('/api/secure/compass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', otherId: otherUser.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'MUTUAL_REQUIRED') {
        toast('🧭 מצפן זמין רק אחרי שניכם עשיתם לייק או שניכם כתבתם בצ׳אט');
      } else if (data.error === 'ALREADY_PENDING') {
        toast('🧭 יש לך כבר בקשת מצפן פעילה');
      } else {
        toast('שגיאה בשליחת בקשת מצפן — נסו שוב');
      }
      return;
    }

    const cs = await res.json();
    compassSessionIdRef.current = cs.id;
    setActiveSessionId(cs.id); // triggers the compass-wait subscription via useRealtimeHub
    setCompassWaiting(true);
    toast('🧭 בקשת מצפן נשלחה! ממתינים לאישור...');

    // ── 5-minute timeout ──
    if (compassTimerRef.current) clearTimeout(compassTimerRef.current);
    compassTimerRef.current = setTimeout(async () => {
      await closeCompass(cs.id, 'expired');
      cleanupCompassState();
      toast('🧭 בקשת המצפן פגה — לא התקבלה תשובה', 5000);
    }, COMPASS_TIMEOUT_MS);
  };

  // ─── Cancel compass wait ──────────────────────────────────
  const cancelCompassWait = async () => {
    if (!compassSessionIdRef.current) return;
    await closeCompass(compassSessionIdRef.current);
    cleanupCompassState();
    toast('🧭 בקשת המצפן בוטלה');
  };

  // ─── Refresh eligibility ──────────────────────────────────
  const refreshEligibility = (otherId: string) => {
    checkCompassEligible(otherId).then(setCompassEligible);
  };

  return {
    compassWaiting,
    compassEligible,
    handleCompassRequest,
    cancelCompassWait,
    refreshEligibility,
  };
}
