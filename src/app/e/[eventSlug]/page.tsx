'use client';

import { use, useEffect, useState, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionStore, useGridStore, useNotificationStore, useSwipeStore } from '@/lib/store';
import { getGridParticipants, getPhotoUrl, markLikeSeen } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/Animations';
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

/** Memoized grid card — only re-renders when participant data or highlights change. */
const GridCard = memo(function GridCard({
  p,
  hasLikeHighlight,
  hasMessageHighlight,
  onCardClick,
}: {
  p: GridParticipant;
  hasLikeHighlight: boolean;
  hasMessageHighlight: boolean;
  onCardClick: () => void;
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
      onClick={onCardClick}
    >
      {p.photos.length > 0 ? (
        <img
          src={getPhotoUrl(p.photos[0].storage_path)}
          alt={p.display_name}
          loading="lazy"
        />
      ) : (
        <div className="avatar-placeholder"><UserIcon size={32} /></div>
      )}
      <div className="card-overlay">
        <div className="name">{p.display_name}</div>
      </div>
      {hasHighlight && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
          {hasLikeHighlight && (
            <span style={{ background: 'var(--primary)', borderRadius: '12px', padding: '3px 8px', display: 'flex', alignItems: 'center', color: '#1a1a1a', animation: 'pulse-badge 2s infinite' }}>
              <HeartFilledIcon size={14} color="#1a1a1a" />
            </span>
          )}
          {hasMessageHighlight && (
            <span style={{ background: 'rgba(255,255,255,0.85)', borderRadius: '12px', padding: '3px 8px', display: 'flex', alignItems: 'center', color: '#1a1a1a', animation: 'pulse-badge 2s infinite' }}>
              <ChatBubbleIcon size={14} color="#1a1a1a" />
            </span>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Main event page — handles:
 * 1. QR redirect (?k=joinCode) → /join
 * 2. Grid view for logged-in participants
 * 3. Swipe (Tinder-style) view as an alternative browsing mode
 */
export default function EventPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const participant = useSessionStore((s) => s.participant);
  const { participants, filter, setParticipants, setFilter, removeParticipant, addParticipant, updateParticipant } = useGridStore();
  const gridHighlights = useNotificationStore((s) => s.gridHighlights);
  const removeGridHighlightByType = useNotificationStore((s) => s.removeGridHighlightByType);
  const viewMode = useSwipeStore((s) => s.viewMode);
  const setViewMode = useSwipeStore((s) => s.setViewMode);
  // Stale-while-revalidate: only show spinner on first-ever load
  const [loading, setLoading] = useState(participants.length === 0);

  const loadGrid = useCallback(async () => {
    const s = useSessionStore.getState().session;
    if (!s) return;
    const data = await getGridParticipants(s.eventId, s.participantId);
    setParticipants(data);
    setLoading(false);
  }, [setParticipants]);

  // QR redirect
  useEffect(() => {
    const joinCode = searchParams.get('k');
    if (joinCode) {
      router.replace(`/e/${eventSlug}/join?k=${joinCode}`);
      return;
    }
    // If no session after layout restore, go home
    if (!session) {
      router.replace('/');
    }
  }, [eventSlug, searchParams, router, session]);

  // Load grid
  useEffect(() => {
    if (session) loadGrid();
  }, [session, eventSlug, loadGrid]);

  // Reload grid when user returns from background / switches back to app
  useAppResume(() => loadGrid(), !!session);

  // Realtime: new participants joining + updates + blocks (via Hub)
  useRealtimeHub({
    channelKey: `grid-live:${session?.eventId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'participants', filter: `event_id=eq.${session?.eventId}` },
        handler: async (payload) => {
          const newP = payload.new as { id: string; gender: string; attracted_to: string; display_name: string; is_banned: boolean };
          if (!session || newP.id === session.participantId || newP.is_banned || !newP.display_name.trim()) return;
          // Cross-attraction check
          const me = participant;
          if (me) {
            const iAmAttracted = me.attracted_to === 'all' ||
              (newP.gender === 'male' && me.attracted_to === 'men') ||
              (newP.gender === 'female' && me.attracted_to === 'women');
            const theyAttracted = newP.attracted_to === 'all' ||
              (me.gender === 'male' && newP.attracted_to === 'men') ||
              (me.gender === 'female' && newP.attracted_to === 'women');
            if (!iAmAttracted || !theyAttracted) return;
          }
          // Fetch their photos
          const { data: photos } = await supabase
            .from('participant_photos')
            .select('id, participant_id, storage_path, order_index')
            .eq('participant_id', newP.id)
            .order('order_index');
          addParticipant({ ...payload.new, photos: photos || [] } as any);
        },
      },
      {
        binding: { event: 'UPDATE', schema: 'public', table: 'participants', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const updated = payload.new as { id: string; is_banned: boolean };
          if (updated.is_banned) {
            removeParticipant(updated.id);
          } else {
            updateParticipant(updated.id, payload.new as any);
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

  if (!session) return null;

  return (
    <MobileGuard>
      <PageTransition>
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
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <StaggerContainer className="profile-grid">
                {filteredParticipants.map((p) => {
                  const highlights = gridHighlights.filter((h) => h.participantId === p.id);
                  const hasLikeHighlight = highlights.some((h) => h.type === 'like');
                  const hasMessageHighlight = highlights.some((h) => h.type === 'message');

                  return (
                  <StaggerItem key={p.id}>
                    <GridCard
                      p={p}
                      hasLikeHighlight={hasLikeHighlight}
                      hasMessageHighlight={hasMessageHighlight}
                      onCardClick={() => {
                        if (hasLikeHighlight) {
                          markLikeSeen(p.id);
                          removeGridHighlightByType(p.id, 'like');
                          useNotificationStore.getState().decrementLikes();
                        }
                        if (hasMessageHighlight) {
                          removeGridHighlightByType(p.id, 'message');
                        }
                        router.push(`/e/${eventSlug}/user/${p.id}`);
                      }}
                    />
                  </StaggerItem>
                  );
                })}
              </StaggerContainer>
            )}
          </div>
          <TabBar />
          <Toast />
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
