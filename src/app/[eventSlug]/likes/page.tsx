'use client';

import { use, useEffect, useState, useCallback, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, useLikesStore, useNotificationStore, useMatchStore } from '@/lib/store';
import { getReceivedLikes, getSentLikes, getMatches, getPhotoUrl, markAllLikesSeen } from '@/lib/api';
import { PHOTO_BLUR_DATA_URL } from '@/lib/image-placeholder';
import { SWR_STALE_MS } from '@/lib/constants';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { useAppResume } from '@/hooks/useAppResume';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import AppHeader from '@/components/AppHeader';
import TabBar from '@/components/TabBar';
import Toast from '@/components/Toast';
import { LikesSkeleton } from '@/components/Skeletons';
import { HeartIcon, HeartFilledIcon, UserIcon, MatchHeartIcon } from '@/components/Icons';
import Image from 'next/image';
import type { PublicParticipant, ParticipantPhoto } from '@/lib/database.types';

/** Memoized participant card used for matches, received, and sent likes. */
const ParticipantCard = memo(function ParticipantCard({
  participant,
  onClick,
  badge,
  priority,
}: {
  participant: PublicParticipant & { photos: ParticipantPhoto[] };
  onClick: (id: string) => void;
  badge?: React.ReactNode;
  priority?: boolean;
}) {
  return (
    <div className="grid-card" onClick={() => onClick(participant.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(participant.id); } }} role="button" tabIndex={0} aria-label={participant.display_name} style={badge ? { position: 'relative' } : undefined}>
      {participant.photos.length > 0 ? (
        <Image
          src={getPhotoUrl(participant.photos[0].storage_path, { width: 360, height: 480, quality: 75 })}
          alt={participant.display_name}
          fill
          sizes="(max-width: 480px) 33vw, 33vw"
          priority={priority}
          placeholder="blur"
          blurDataURL={PHOTO_BLUR_DATA_URL}
        />
      ) : (
        <div className="avatar-placeholder"><UserIcon size={32} /></div>
      )}
      <div className="card-overlay"><div className="name">{participant.display_name}</div></div>
      {badge}
    </div>
  );
});

export default function LikesPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const [tab, setTab] = useState<'matches' | 'received' | 'sent'>('matches');
  const activePanelId = `tabpanel-${tab}`;
  const receivedLikes = useLikesStore((s) => s.receivedLikes);
  const sentLikes = useLikesStore((s) => s.sentLikes);
  const setReceivedLikes = useLikesStore((s) => s.setReceivedLikes);
  const setSentLikes = useLikesStore((s) => s.setSentLikes);
  const matches = useMatchStore((s) => s.matches);
  const matchesLoaded = useMatchStore((s) => s.matchesLoaded);
  const setMatches = useMatchStore((s) => s.setMatches);
  // Stale-while-revalidate: only show spinner on first-ever load
  const [loading, setLoading] = useState(!matchesLoaded && receivedLikes.length === 0);
  const lastFetchRef = useRef(0);

  // Stable callback for profile navigation - avoids re-creating closures per card
  const handleProfileClick = useCallback((id: string) => {
    router.push(`/${eventSlug}/user/${id}`);
  }, [router, eventSlug]);

  const loadLikes = useCallback(async () => {
    const s = useSessionStore.getState().session;
    if (!s) return;
    try {
      const [received, sent, matchList] = await Promise.all([
        getReceivedLikes(s.eventId, s.participantId),
        getSentLikes(s.eventId, s.participantId),
        getMatches(s.eventId, s.participantId),
      ]);
      setReceivedLikes(received);
      setSentLikes(sent);
      setMatches(matchList);
      lastFetchRef.current = Date.now();
    } catch {
      // Silently fail - stale data is better than a stuck spinner
    } finally {
      setLoading(false);
    }
  }, [setReceivedLikes, setSentLikes, setMatches]);

  useEffect(() => {
    if (Date.now() - lastFetchRef.current < SWR_STALE_MS) return;
    loadLikes();
  }, [loadLikes, session]);

  // Mark all likes as seen when entering the likes page (only if there are unread likes)
  useEffect(() => {
    if (!session) return;
    const { unreadLikes } = useNotificationStore.getState();
    if (unreadLikes > 0) {
      markAllLikesSeen();
      useNotificationStore.getState().setUnreadLikes(0);
      const highlights = useNotificationStore.getState().gridHighlights;
      for (const h of highlights) {
        if (h.type === 'like') {
          useNotificationStore.getState().removeGridHighlightByType(h.participantId, 'like');
        }
      }
    }
  }, [session]);

  // Reload likes when user returns from background
  useAppResume(() => loadLikes(), !!session);

  // Realtime via Hub - local updates where possible
  useRealtimeHub({
    channelKey: `likes:${session?.eventId}`,
    postgres: [
      {
        binding: { event: 'INSERT', schema: 'public', table: 'likes', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const like = payload.new as { to_participant_id: string };
          // Only reload when someone liked ME (need participant data for card)
          if (like.to_participant_id === session?.participantId) loadLikes();
        },
      },
      {
        binding: { event: 'DELETE', schema: 'public', table: 'likes', filter: `event_id=eq.${session?.eventId}` },
        handler: () => loadLikes(), // DELETE payload lacks old row - must reload
      },
      {
        binding: { event: 'INSERT', schema: 'public', table: 'blocks', filter: `event_id=eq.${session?.eventId}` },
        handler: (payload) => {
          const block = payload.new as { blocker_id: string; blocked_id: string };
          if (block.blocker_id === session?.participantId || block.blocked_id === session?.participantId) {
            const otherId = block.blocker_id === session?.participantId ? block.blocked_id : block.blocker_id;
            // Remove locally - no network round-trip needed
            useLikesStore.getState().removeParticipantLikes(otherId);
            useMatchStore.getState().removeMatch(otherId);
          }
        },
      },
    ],
    enabled: !!session,
  });

  return (
    <MobileGuard>
      <PageTransition>
        <div className="app-container">
          <AppHeader />
          <div className="main-content">
            {/* Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }} role="tablist" aria-label="סוגי לייקים" onKeyDown={(e) => { const tabs = ['matches', 'received', 'sent'] as const; const idx = tabs.indexOf(tab); let next: typeof tab | undefined; if (e.key === 'ArrowLeft') next = tabs[(idx + 1) % 3]; else if (e.key === 'ArrowRight') next = tabs[(idx - 1 + 3) % 3]; if (next) { e.preventDefault(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>
              <button
                onClick={() => setTab('matches')}
                id="tab-matches"
                role="tab"
                aria-selected={tab === 'matches'}
                tabIndex={tab === 'matches' ? 0 : -1}
                aria-controls="tabpanel-matches"
                style={{
                  flex: 1, padding: '12px', background: 'none', border: 'none',
                  borderBottom: tab === 'matches' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === 'matches' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                התאמות ({matches.length})
              </button>
              <button
                onClick={() => setTab('received')}
                id="tab-received"
                role="tab"
                aria-selected={tab === 'received'}
                tabIndex={tab === 'received' ? 0 : -1}
                aria-controls="tabpanel-received"
                style={{
                  flex: 1, padding: '12px', background: 'none', border: 'none',
                  borderBottom: tab === 'received' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === 'received' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                קיבלתי ({receivedLikes.length})
              </button>
              <button
                onClick={() => setTab('sent')}
                id="tab-sent"
                role="tab"
                aria-selected={tab === 'sent'}
                tabIndex={tab === 'sent' ? 0 : -1}
                aria-controls="tabpanel-sent"
                style={{
                  flex: 1, padding: '12px', background: 'none', border: 'none',
                  borderBottom: tab === 'sent' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === 'sent' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                עשיתי ({sentLikes.length})
              </button>
            </div>

            {loading ? (
              <LikesSkeleton />
            ) : (
              <div className="likes-section" id={activePanelId} role="tabpanel" aria-labelledby={`tab-${tab}`}>
                {tab === 'matches' ? (
                  matches.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--foreground)', padding: '40px' }}>
                      <div style={{ marginBottom: '16px', opacity: 0.8 }}><MatchHeartIcon size={56} color="var(--primary)" /></div>
                      <p style={{ fontSize: '16px', fontWeight: 500 }}>עדיין אין התאמות</p>
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        כששני אנשים עושים לייק אחד לשני - זו התאמה!
                      </p>
                    </div>
                  ) : (
                    <StaggerContainer className="profile-grid">
                      {matches.map((match, index) => {
                        const p = match.participant;
                        return (
                          <StaggerItem key={match.participantId}>
                            <ParticipantCard
                              participant={p}
                              onClick={handleProfileClick}
                              priority={index < 6}
                              badge={
                                  <div aria-hidden="true" style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  background: 'linear-gradient(135deg, var(--primary), #ff6b9d)',
                                  borderRadius: '8px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#1a1a1a',
                                }}>
                                  💞 Match
                                </div>
                              }
                            />
                          </StaggerItem>
                        );
                      })}
                    </StaggerContainer>
                  )
                ) : tab === 'received' ? (
                  receivedLikes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--foreground)', padding: '40px' }}>
                      <div style={{ marginBottom: '16px', opacity: 0.8 }}><HeartFilledIcon size={48} color="var(--primary)" /></div>
                      <p style={{ fontSize: '16px', fontWeight: 500 }}>עדיין לא קיבלתם לייקים</p>
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        כשמישהו יעשה לכם לייק - הוא יופיע כאן!
                      </p>
                    </div>
                  ) : (
                    <StaggerContainer className="profile-grid">
                      {receivedLikes.map((like, index) => {
                        const p = like.from;
                        return (
                          <StaggerItem key={like.id}>
                            <ParticipantCard participant={p} onClick={handleProfileClick} priority={index < 6} />
                          </StaggerItem>
                        );
                      })}
                    </StaggerContainer>
                  )
                ) : sentLikes.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--foreground)', padding: '40px' }}>
                    <div style={{ marginBottom: '16px', opacity: 0.8 }}><HeartIcon size={48} color="var(--primary)" /></div>
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>עדיין לא עשיתם לייקים</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      גלשו לגריד ותעשו לייק למי שמוצא חן לכם!
                    </p>
                  </div>
                ) : (
                  <StaggerContainer className="profile-grid">
                    {sentLikes.map((like, index) => {
                      const p = like.to;
                      return (
                        <StaggerItem key={like.id}>
                          <ParticipantCard participant={p} onClick={handleProfileClick} priority={index < 6} />
                        </StaggerItem>
                      );
                    })}
                  </StaggerContainer>
                )}
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
