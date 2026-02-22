'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useSessionStore, useSwipeStore, useToastStore, useMatchStore } from '@/lib/store';
import { sendLike, getSentLikeIds, getPhotoUrl } from '@/lib/api';
import { HeartFilledIcon, SearchIcon } from '@/components/Icons';
import type { GridParticipant } from '@/lib/store';
import SwipeCard from './SwipeCard';

/* ── Props ─────────────────────────────────────────────────────── */

interface SwipeViewProps {
  /** Already-filtered participants from the grid (respects gender filter). */
  participants: GridParticipant[];
  eventSlug: string;
}

/**
 * Tinder-style swipe deck.
 *
 * Renders a stack of `SwipeCard`s drawn from the grid participants.
 * - Swipe right → `sendLike` (same API the profile page uses).
 * - Swipe left → dismiss (skip) - restorable via "reset pool".
 * - Liked participants are excluded even after a reset.
 * - New participants from realtime updates appear automatically
 *   because the source is the same `useGridStore.participants`.
 */
export default function SwipeView({ participants, eventSlug }: SwipeViewProps) {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const toast = useToastStore((s) => s.show);

  const {
    dismissedIds,
    likedIds,
    likedIdsLoaded,
    dismiss,
    addLiked,
    setLikedIds,
    resetPool,
  } = useSwipeStore();

  /* ── Seed liked IDs from the server on first mount ─────────── */
  useEffect(() => {
    if (!session || likedIdsLoaded) return;

    getSentLikeIds(session.eventId, session.participantId).then((ids) => {
      setLikedIds(ids);
    });
  }, [session, likedIdsLoaded, setLikedIds]);

  /* ── Build the swipe stack ─────────────────────────────────── */
  const stack = useMemo(
    () =>
      participants.filter(
        (p) => !dismissedIds.has(p.id) && !likedIds.has(p.id),
      ),
    [participants, dismissedIds, likedIds],
  );

  /** Only render the top 3 cards for performance. */
  const visibleCards = stack.slice(0, 3);

  /* ── Handlers ──────────────────────────────────────────────── */

  const handleSwipeRight = useCallback(
    async (id: string) => {
      addLiked(id);
      const result = await sendLike(id);
      if (result) {
        if (result.match) {
          // It's a match! Build popup data from the participant we just swiped on
          const p = participants.find((pp) => pp.id === id);
          useMatchStore.getState().setPendingMatch({
            id,
            displayName: p?.display_name ?? '',
            photoUrl: p?.photos?.[0] ? getPhotoUrl(p.photos[0].storage_path) : null,
          });
        } else {
          toast('💗 לייק נשלח!');
        }
      } else {
        toast('שגיאה בשליחת הלייק - נסו שוב');
      }
    },
    [addLiked, toast, participants],
  );

  const handleSwipeLeft = useCallback(
    (id: string) => {
      dismiss(id);
    },
    [dismiss],
  );

  const handleViewProfile = useCallback(
    (id: string) => {
      router.push(`/dating/${eventSlug}/user/${id}`);
    },
    [router, eventSlug],
  );

  const handleReset = useCallback(() => {
    resetPool();
    toast('הרשימה אופסה - כולם חזרו (חוץ מאלו שכבר עשית להם לייק!)');
  }, [resetPool, toast]);

  /* ── Empty state ───────────────────────────────────────────── */

  if (!likedIdsLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (stack.length === 0) {
    const allDismissed = dismissedIds.size > 0;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <div style={{ opacity: 0.8, color: 'var(--primary)' }}>
          {allDismissed ? (
            <SearchIcon size={52} />
          ) : (
            <HeartFilledIcon size={52} color="var(--primary)" />
          )}
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)' }}>
          {allDismissed ? 'עברת על כולם! 🎉' : 'אין משתתפים חדשים כרגע'}
        </p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {allDismissed
            ? 'כשמישהו חדש יצטרף - הוא יופיע כאן אוטומטית'
            : 'ברגע שמישהו חדש יצטרף לאירוע, הוא יופיע כאן'}
        </p>
        {allDismissed && (
          <button
            onClick={handleReset}
            style={{
              marginTop: '8px',
              padding: '12px 28px',
              borderRadius: '24px',
              background: 'var(--primary)',
              border: 'none',
              color: '#1a1a1a',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 אפס רשימה
          </button>
        )}
      </div>
    );
  }

  /* ── Card deck ─────────────────────────────────────────────── */

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        padding: '0 12px',
        overflow: 'hidden',
      }}
    >
      {/* Card stack area - stretches to fill remaining space */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
        }}
      >
        <AnimatePresence>
          {visibleCards.map((p, i) => (
            <SwipeCard
              key={p.id}
              participant={p}
              isTop={i === 0}
              stackIndex={i}
              onSwipeRight={() => handleSwipeRight(p.id)}
              onSwipeLeft={() => handleSwipeLeft(p.id)}
              onViewProfile={() => handleViewProfile(p.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
