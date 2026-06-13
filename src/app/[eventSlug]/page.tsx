'use client';

import { Suspense, use, useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionStore, useGridStore, useNotificationStore, useSwipeStore } from '@/lib/store';
import { getGridParticipants, getPhotoUrl, markLikeSeen, getParticipant, getParticipantPhotos, matchesCrossAttraction } from '@/lib/api';
import { PHOTO_BLUR_DATA_URL } from '@/lib/image-placeholder';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { LEGACY_LOCAL_ID_KEY, PROFILE_SETUP_KEY_PREFIX, SWR_STALE_MS } from '@/lib/constants';
import { useAppResume } from '@/hooks/useAppResume';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import AppHeader from '@/components/AppHeader';
import TabBar from '@/components/TabBar';
import Toast from '@/components/Toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { GridSkeleton } from '@/components/Skeletons';
import { SearchIcon, UserIcon, HeartFilledIcon, ChatBubbleIcon } from '@/components/Icons';
const SwipeView = dynamic(() => import('./_components/SwipeView'), {
  loading: () => <LoadingSpinner />,
});
import type { Gender } from '@/lib/database.types';
import type { GridParticipant } from '@/lib/stores/grid';

const ABOVE_FOLD_PRELOAD_COUNT = 6;

/**
 * Module-level last-fetch timestamp. Persists across navigation so the
 * SWR stale check works correctly when the user navigates back to the grid.
 * A React ref resets to 0 on every component remount, defeating the stale check.
 */
let _lastGridFetchTime = 0;

function usePreloadImages(urls: string[]) {
  useEffect(() => {
    if (typeof document === 'undefined' || urls.length === 0) return;

    const created: HTMLLinkElement[] = [];

    for (const url of urls) {
      if (document.head.querySelector(`link[data-grid-preload="${CSS.escape(url)}"]`)) continue;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.setAttribute('data-grid-preload', url);
      document.head.appendChild(link);
      created.push(link);
    }

    return () => {
      for (const link of created) {
        link.remove();
      }
    };
  }, [urls]);
}

/** Memoized grid card - only re-renders when participant data or highlights change. */
const GridCard = memo(function GridCard({
  p,
  hasLikeHighlight,
  hasMessageHighlight,
  onCardClick,
  priority,
}: {
  p: GridParticipant;
  hasLikeHighlight: boolean;
  hasMessageHighlight: boolean;
  onCardClick: (id: string) => void;
  /** True for above-the-fold cards (first 6) - enables eager loading / preload. */
  priority?: boolean;
}) {
  const hasHighlight = hasLikeHighlight || hasMessageHighlight;
  return (
    <div
      className={`grid-card${hasHighlight ? ' grid-card-highlight' : ''}`}
      style={hasHighlight ? {
        boxShadow: hasLikeHighlight
          ? '0 0 0 2px var(--primary), 0 0 12px rgba(212,165,154,0.3)'
          : '0 0 0 2px rgba(255,255,255,0.3), 0 0 12px rgba(255,255,255,0.1)',
      } : undefined}
      onClick={() => onCardClick(p.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(p.id); } }}
      role="button"
      tabIndex={0}
      aria-label={p.display_name}
    >
      {(p.photos?.length ?? 0) > 0 ? (
        <Image
          src={getPhotoUrl(p.photos![0].storage_path, { width: 360, height: 480, quality: 75 })}
          alt={p.display_name}
          fill
          sizes="(max-width: 480px) 33vw, 33vw"
          priority={priority}
          placeholder="blur"
          blurDataURL={PHOTO_BLUR_DATA_URL}
        />
      ) : (
        <div className="avatar-placeholder"><UserIcon size={32} /></div>
      )}
      <div className="card-overlay">
        <div className="name">{p.display_name}{p.age ? `, ${p.age}` : ''}</div>
      </div>
      {hasHighlight && (
        <div className="grid-card-badges">
          {hasLikeHighlight && (
            <span className="badge-like">
              <HeartFilledIcon size={14} color="#1a1a1a" />
            </span>
          )}
          {hasMessageHighlight && (
            <span className="badge-message">
              <ChatBubbleIcon size={14} color="#1a1a1a" />
            </span>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Main event page - handles:
 * 1. QR redirect (?k=joinCode) → /join
 * 2. Grid view for logged-in participants
 * 3. Swipe (Tinder-style) view as an alternative browsing mode
 */
export default function EventPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  return (
    <Suspense fallback={<div className="app-container" />}>
      <EventPageContent params={params} />
    </Suspense>
  );
}

function EventPageContent({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const participant = useSessionStore((s) => s.participant);
  const setParticipant = useSessionStore((s) => s.setParticipant);
  const participants = useGridStore((s) => s.participants);
  const filter = useGridStore((s) => s.filter);
  const setParticipants = useGridStore((s) => s.setParticipants);
  const setFilter = useGridStore((s) => s.setFilter);
  const removeParticipant = useGridStore((s) => s.removeParticipant);
  const addParticipant = useGridStore((s) => s.addParticipant);
  const updateParticipant = useGridStore((s) => s.updateParticipant);
  const gridHighlights = useNotificationStore((s) => s.gridHighlights);
  const viewMode = useSwipeStore((s) => s.viewMode);
  const setViewMode = useSwipeStore((s) => s.setViewMode);
  // Stale-while-revalidate: only show spinner on first-ever load
  const [loading, setLoading] = useState(participants.length === 0);

  const loadGrid = useCallback(async () => {
    const s = useSessionStore.getState().session;
    if (!s) return;
    try {
      const data = await getGridParticipants(s.eventId, s.participantId);
      const current = useGridStore.getState().participants;
      if (data.length === 0 && current.length > 0) return; // protect against empty-on-error
      // Skip re-render if the participant IDs are unchanged - avoids virtualizer flash
      const currentIds = current.map((p) => p.id).join(',');
      const newIds = data.map((p) => p.id).join(',');
      if (currentIds !== newIds || data.length !== current.length) {
        setParticipants(data);
      }
      _lastGridFetchTime = Date.now();
    } catch {
      // Silently fail - stale data is better than a stuck spinner
    } finally {
      setLoading(false);
    }
  }, [setParticipants]);

  // QR redirect
  useEffect(() => {
    const joinCode = searchParams.get('k');
    if (joinCode) {
      // If user already has a valid session for this event, just strip ?k and stay
      if (session && session.eventSlug === eventSlug) {
        router.replace(`/${eventSlug}`);
        return;
      }
      router.replace(`/${eventSlug}/join`);
      return;
    }
    // If no session after layout restore, redirect to join page
    if (!session) {
      router.replace(`/${eventSlug}/join`);
    }
  }, [eventSlug, searchParams, router, session]);

  // Profile completeness guard - redirect to setup if profile is incomplete
  useEffect(() => {
    if (!session) return;
    const hasProfile = localStorage.getItem(`${PROFILE_SETUP_KEY_PREFIX}${session.participantId}`);
    if (hasProfile) return; // already completed setup

    // Verify against DB in case localStorage was cleared
    getParticipant(session.participantId).then((p) => {
      if (!p) return;
      if (p.display_name.trim() && p.age != null) {
        // Profile is actually complete - restore the flag
        localStorage.setItem(`${PROFILE_SETUP_KEY_PREFIX}${session.participantId}`, 'true');
        setParticipant(p);
      } else {
        // Profile is incomplete - redirect to setup
        router.replace(`/${eventSlug}/setup`);
      }
    });
  }, [session, eventSlug, router, setParticipant]);

  // Load grid (skip if recently fetched - Realtime keeps data fresh)
  useEffect(() => {
    if (!session) return;
    // If data was fetched recently we skip the network call - but we MUST still clear
    // the loading flag. `loading` is initialised from `participants.length === 0`, so a
    // remount (e.g. switching tabs back to the grid) with an empty store + a fresh
    // fetch timestamp would otherwise leave the skeletons stuck on screen until a full
    // page refresh resets the module-level timer. Clearing it here fixes that.
    if (Date.now() - _lastGridFetchTime < SWR_STALE_MS) {
      setLoading(false);
      return;
    }
    loadGrid();
  }, [session, eventSlug, loadGrid]);

  // Reload grid when user returns from background / switches back to app
  // Only reload if data is stale - avoids replacing fresh data every app-switch
  useAppResume(() => {
    if (Date.now() - _lastGridFetchTime >= SWR_STALE_MS) {
      loadGrid();
    }
  }, !!session);

  // Realtime: new participants joining + updates + blocks (via Hub)
  useRealtimeHub({
    channelKey: `grid-live:${session?.eventId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'participants', filter: `event_id=eq.${session?.eventId}` },
        handler: async (payload) => {
          const newP = payload.new as { id: string; gender: string; attracted_to: string; display_name: string; is_banned: boolean };
          if (!session || newP.id === session.participantId || newP.is_banned || !newP.display_name.trim()) return;
          // Cross-attraction check (reuse shared helper)
          if (participant && !matchesCrossAttraction(participant, newP)) return;
          // Fetch their photos via API wrapper
          const photos = await getParticipantPhotos(newP.id);
          // Strip encrypted/internal columns before adding to store
          const { bio_enc, looking_for_enc, phone_enc, phone_bi, bio, looking_for, phone, ...newPSafe } = payload.new as Record<string, unknown>;
          addParticipant({ ...newPSafe, photos } as GridParticipant);
        },
      },
      {
        binding: { event: 'UPDATE', schema: 'public', table: 'participants', filter: `event_id=eq.${session?.eventId}` },
        handler: async (payload) => {
          const updated = payload.new as { id: string; is_banned: boolean; display_name: string; gender: string; attracted_to: string; age: number | null };
          if (updated.is_banned) {
            // If THIS user was banned, kick them immediately
            if (updated.id === session?.participantId) {
              useSessionStore.getState().clearSession();
              localStorage.removeItem(LEGACY_LOCAL_ID_KEY);
              window.location.href = `/${eventSlug}/banned`;
              return;
            }
            removeParticipant(updated.id);
            return;
          }

          // Check if participant is already in the grid store
          const existsInGrid = useGridStore.getState().participants.some((p) => p.id === updated.id);

          if (existsInGrid) {
            // Only update non-PII, non-photos fields from Realtime payload.
            // Realtime rows don't contain photos or decrypted PII, so we preserve
            // the existing photos array and ignore _enc/_bi columns.
            const { photos: _photos, bio, looking_for, phone, bio_enc, looking_for_enc, phone_enc, phone_bi, ...safeFields } = payload.new as Partial<GridParticipant> & Record<string, unknown>;
            updateParticipant(updated.id, safeFields as Partial<GridParticipant>);
          } else {
            // Participant completed their profile - check if they should be added
            if (!session || updated.id === session.participantId) return;
            if (!updated.display_name?.trim() || updated.age == null) return;

            // Cross-attraction check (reuse shared helper)
            if (participant && !matchesCrossAttraction(participant, updated)) return;

            // Fetch their photos via API wrapper
            const photos = await getParticipantPhotos(updated.id);

            // Only add if they have at least one photo
            if (photos && photos.length > 0) {
              const { bio_enc, looking_for_enc, phone_enc, phone_bi, bio, looking_for, phone, ...updSafe } = payload.new as Record<string, unknown>;
              addParticipant({ ...updSafe, photos } as GridParticipant);
            }
          }
        },
      },
      {
        binding: { event: 'INSERT', schema: 'public', table: 'blocks', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const block = payload.new as { blocker_id: string; blocked_id: string };
          if (block.blocker_id === session?.participantId || block.blocked_id === session?.participantId) {
            const otherId = block.blocker_id === session?.participantId ? block.blocked_id : block.blocker_id;
            removeParticipant(otherId);
          }
        },
      },
    ],
    enabled: !!session,
  });

  // Default filter based on attraction
  useEffect(() => {
    if (participant?.attracted_to && participant.attracted_to !== 'all') {
      // Cross-attraction already filters server-side, reset to 'all'
      setFilter('all');
    }
  }, [participant, setFilter]);

  // Stable callback for grid card clicks - avoids re-creating closures per card
  const handleCardClick = useCallback((id: string) => {
    const highlights = useNotificationStore.getState().gridHighlights;
    const hasLike = highlights.some((h) => h.participantId === id && h.type === 'like');
    const hasMsg = highlights.some((h) => h.participantId === id && h.type === 'message');
    if (hasLike) {
      markLikeSeen(id);
      useNotificationStore.getState().removeGridHighlightByType(id, 'like');
      useNotificationStore.getState().decrementLikes();
    }
    if (hasMsg) {
      useNotificationStore.getState().removeGridHighlightByType(id, 'message');
    }
    router.push(`/${eventSlug}/user/${id}`);
  }, [router, eventSlug]);

  // Only show filter bar when attracted_to is 'all' (otherwise cross-attraction handles it)
  const showFilterBar = participant?.attracted_to === 'all';

  const genderFilterMap: Record<string, Gender | 'all'> = {
    men: 'male',
    women: 'female',
    all: 'all',
  };

  const filteredParticipants = participants.filter((p) => {
    if (!showFilterBar || filter === 'all') return true;
    return p.gender === genderFilterMap[filter];
  });

  // Pre-compute highlight lookups as Sets for O(1) per card instead of O(n)
  const likeHighlightIds = useMemo(
    () => new Set(gridHighlights.filter((h) => h.type === 'like').map((h) => h.participantId)),
    [gridHighlights],
  );
  const messageHighlightIds = useMemo(
    () => new Set(gridHighlights.filter((h) => h.type === 'message').map((h) => h.participantId)),
    [gridHighlights],
  );

  const preloadUrls = useMemo(
    () => filteredParticipants
      .slice(0, ABOVE_FOLD_PRELOAD_COUNT)
      .flatMap((p) => (p.photos?.[0]
        ? [getPhotoUrl(p.photos[0].storage_path, { width: 360, height: 480, quality: 75 })]
        : [])),
    [filteredParticipants],
  );

  usePreloadImages(preloadUrls);

  if (!session) return null;

  return (
    <MobileGuard>
      {/* Skip animation when navigating back to an already-populated grid */}
      <PageTransition instant={participants.length > 0}>
        <div className="app-container">
          <AppHeader />
          <div
            className="main-content"
            style={viewMode === 'swipe' ? {
              display: 'flex',
              flexDirection: 'column' as const,
              height: '100dvh',
              overflow: 'hidden',
            } : undefined}
          >
            {/* ── View toggle (centered) ── */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px', paddingBottom: showFilterBar ? 0 : undefined }}>
              {/* View mode toggle */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="תצוגת גריד"
                  style={{
                    padding: '10px 32px',
                    background: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    color: viewMode === 'grid' ? '#1a1a1a' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('swipe')}
                  aria-label="תצוגת סווייפ"
                  style={{
                    padding: '10px 32px',
                    background: viewMode === 'swipe' ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    color: viewMode === 'swipe' ? '#1a1a1a' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="3" width="16" height="18" rx="3" />
                    <path d="M8 21h8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Gender filter chips */}
            {showFilterBar && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px' }}>
                <div className="filter-bar" style={{ padding: '0' }}>
                  {(['all', 'men', 'women'] as const).map((f) => (
                    <button
                      key={f}
                      className={`filter-chip ${filter === f ? 'active' : ''}`}
                      onClick={() => setFilter(f)}
                      aria-pressed={filter === f}
                    >
                      {f === 'all' ? 'כולם' : f === 'men' ? 'גברים' : 'נשים'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <GridSkeleton />
            ) : filteredParticipants.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ marginBottom: '16px', opacity: 0.5 }}><SearchIcon size={48} /></div>
                <p>אין משתתפים להצגה כרגע</p>
              </div>
            ) : viewMode === 'swipe' ? (
              /* ── Swipe mode ── */
              <SwipeView participants={filteredParticipants} eventSlug={eventSlug} />
            ) : (
              /* ── Grid mode: plain CSS grid, no virtualizer ── */
              <div className="profile-grid">
                {filteredParticipants.map((p, i) => (
                  <GridCard
                    key={p.id}
                    p={p}
                    hasLikeHighlight={likeHighlightIds.has(p.id)}
                    hasMessageHighlight={messageHighlightIds.has(p.id)}
                    onCardClick={handleCardClick}
                    priority={i < 6}
                  />
                ))}
              </div>
            )}
          </div>
          <TabBar />
          <Toast />
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
