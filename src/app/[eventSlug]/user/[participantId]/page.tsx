'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSessionStore, useToastStore, useNotificationStore, useSwipeStore, useMatchStore, useGridStore } from '@/lib/store';
import { PHOTO_BLUR_DATA_URL } from '@/lib/image-placeholder';
import { UserIcon } from '@/components/Icons';
import {
  getParticipant,
  getPhotoUrl,
  sendLike,
  removeLike,
  hasLiked,
  getOrCreateConversation,
  blockParticipant,
  markLikeSeen,
} from '@/lib/api';
import { PageTransition, LikeAnimation } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import BlockConfirmDialog from '@/components/BlockConfirmDialog';
import { LOOKING_FOR_LABELS } from '@/lib/constants';
import type { PublicParticipant, ParticipantPhoto } from '@/lib/database.types';

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ eventSlug: string; participantId: string }>;
}) {
  const { eventSlug, participantId } = use(params);
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const toast = useToastStore((s) => s.show);
  const addLiked = useSwipeStore((s) => s.addLiked);
  const removeLiked = useSwipeStore((s) => s.removeLiked);
  const startPendingLike = useSwipeStore((s) => s.startPendingLike);
  const finishPendingLike = useSwipeStore((s) => s.finishPendingLike);

  // Seed from grid store for instant display (stale-while-revalidate)
  const cached = useGridStore((s) => s.participants.find((p) => p.id === participantId)) ?? null;
  const [user, setUser] = useState<(PublicParticipant & { photos: ParticipantPhoto[] }) | null>(cached);
  const [liked, setLiked] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(!cached);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [messagePending, setMessagePending] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    async function load() {
      if (!session) return;
      // Only show full spinner if we have no cached data
      if (!cached) setLoading(true);
      const [p, isLiked] = await Promise.all([
        getParticipant(participantId),
        hasLiked(session.eventId, session.participantId, participantId),
      ]);
      if (p) setUser(p); // Update with fresh data (may have new photos/bio)
      setLiked(isLiked);
      setLoading(false);

      // Mark like from this user as seen (if any)
      markLikeSeen(participantId);
      useNotificationStore.getState().removeGridHighlightByType(participantId, 'like');
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cached store selectors never change identity
  }, [session, participantId]);

  const handleLike = async () => {
    if (!session) return;
    if (!liked && useSwipeStore.getState().isPendingLike(participantId)) return;

    if (liked) {
      // Optimistic: update UI immediately, revert on failure
      setLiked(false);
      removeLiked(participantId);
      useMatchStore.getState().removeMatch(participantId);
      const ok = await removeLike(participantId);
      if (ok) {
        toast('הלייק הוסר');
      } else {
        // Revert
        setLiked(true);
        addLiked(participantId);
        toast('שגיאה בהסרת הלייק - נסו שוב');
      }
    } else {
      // Optimistic: show liked immediately
      startPendingLike(participantId);
      setLiked(true);
      addLiked(participantId);
      try {
        const result = await sendLike(participantId);
        if (result) {
          if ('duplicate' in result) {
            // Duplicate like race: treat as success and keep optimistic state.
          } else if (result.match && user) {
            useMatchStore.getState().setPendingMatch({
              id: participantId,
              displayName: user.display_name,
              photoUrl: user.photos?.[0]
                ? getPhotoUrl(user.photos[0].storage_path, { width: 480, height: 640, quality: 80 })
                : null,
            });
          } else {
            toast('💗 לייק נשלח!');
          }
        } else {
          // Revert
          setLiked(false);
          removeLiked(participantId);
          toast('שגיאה בשליחת הלייק - נסו שוב');
        }
      } finally {
        finishPendingLike(participantId);
      }
    }
  };

  const handleMessage = async () => {
    if (!session || messagePending) return;
    setMessagePending(true);
    const conv = await getOrCreateConversation(
      participantId
    );
    setMessagePending(false);
    if (conv) {
      router.push(`/${eventSlug}/chat/${conv.id}`);
    } else {
      toast('שגיאה בפתיחת שיחה - נסו שוב');
    }
  };

  const handleBlock = async () => {
    if (!session) return;
    const success = await blockParticipant(
      participantId
    );
    if (success) {
      toast('המשתמש נחסם');
      router.back();
    } else {
      toast('שגיאה בחסימה - נסו שוב');
    }
  };

  if (loading) {
    return (
      <MobileGuard>
        <LoadingSpinner />
      </MobileGuard>
    );
  }

  if (!user) {
    return (
      <MobileGuard>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>המשתמש לא נמצא</p>
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => router.back()}>
            חזרה
          </button>
        </div>
      </MobileGuard>
    );
  }

  return (
    <MobileGuard>
      <PageTransition>
        <div className="profile-view">
        <h1 className="sr-only">פרופיל {user.display_name}</h1>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          aria-label="חזרה"
          style={{
            position: 'absolute',
            top: 'calc(12px + env(safe-area-inset-top))',
            right: '12px',
            zIndex: 10,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          ✕
        </button>

        {/* Photos carousel with swipe + tap zones */}
        <div
          className="profile-photos"
          tabIndex={0}
          role="region"
          aria-roledescription="קרוסלה"
          aria-label={`תמונות של ${user.display_name}, ${photoIndex + 1} מתוך ${user.photos.length}`}
          onKeyDown={(e) => {
            if (user.photos.length <= 1) return;
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setPhotoIndex((i) => (i + 1) % user.photos.length);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setPhotoIndex((i) => (i - 1 + user.photos.length) % user.photos.length);
            }
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || user.photos.length <= 1) return;
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
              if (diff > 0) {
                // swipe left = next
                setPhotoIndex((i) => (i + 1) % user.photos.length);
              } else {
                // swipe right = prev
                setPhotoIndex((i) => (i - 1 + user.photos.length) % user.photos.length);
              }
            }
            touchStartX.current = null;
          }}
          onClick={(e) => {
            if (user.photos.length <= 1) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 2) {
              // tap left = prev
              setPhotoIndex((i) => (i - 1 + user.photos.length) % user.photos.length);
            } else {
              // tap right = next
              setPhotoIndex((i) => (i + 1) % user.photos.length);
            }
          }}
        >
          {user.photos.length > 0 ? (
            <Image
              src={getPhotoUrl(user.photos[photoIndex].storage_path, { width: 900, height: 1200, quality: 80 })}
              alt={user.display_name}
              fill
              sizes="100vw"
              priority
              placeholder="blur"
              blurDataURL={PHOTO_BLUR_DATA_URL}
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="avatar-placeholder"><UserIcon size={64} /></div>
          )}

          {/* Photo dots */}
          {user.photos.length > 1 && (
            <>
              {/* Progress bar at top */}
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '16px',
                  right: '16px',
                  display: 'flex',
                  gap: '4px',
                  zIndex: 5,
                }}
              >
                {user.photos.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '2px',
                      background: i === photoIndex ? 'white' : 'rgba(255,255,255,0.35)',
                      transition: 'background 0.25s',
                    }}
                  />
                ))}
              </div>
              {/* Left/right arrow hints */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '8px',
                  transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '24px',
                  pointerEvents: 'none',
                }}
              >
                ‹
              </div>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '8px',
                  transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '24px',
                  pointerEvents: 'none',
                }}
              >
                ›
              </div>
            </>
          )}
        </div>

        {/* Details */}
        <div className="profile-details">
          <div className="profile-name">
            {user.display_name}
            {user.age && <span style={{ fontSize: '18px', fontWeight: 400, color: 'var(--text-muted)', marginRight: '8px' }}>{user.age}</span>}
          </div>
          <div className="profile-gender">
            {user.gender === 'male' ? 'גבר' : user.gender === 'female' ? 'אישה' : 'אחר'}
            {user.city ? ` · ${user.city}` : ''}
          </div>
          {user.looking_for && (
            <div style={{
              display: 'inline-block',
              marginTop: '8px',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(212, 165, 154, 0.15)',
              border: '1px solid rgba(212, 165, 154, 0.3)',
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: 500,
            }}>
              {LOOKING_FOR_LABELS[user.looking_for]}
            </div>
          )}
          {user.bio && (
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.5 }}>
              {user.bio}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="profile-actions">
          <button
            className={`profile-action-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <LikeAnimation liked={liked} />
            {liked ? 'ביטול לייק' : 'לייק'}
          </button>

          <button className="profile-action-btn" onClick={handleMessage} disabled={messagePending} style={messagePending ? { opacity: 0.6 } : undefined}>
            {messagePending ? (
              <span style={{ width: '24px', height: '24px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
            ) : (
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            )}
            הודעה
          </button>

          <button
            className="profile-action-btn"
            onClick={() => setShowBlockConfirm(true)}
            style={{ color: 'var(--danger)' }}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            חסימה
          </button>
        </div>
      </div>
      </PageTransition>

      {/* Block confirmation dialog */}
      <BlockConfirmDialog
        isOpen={showBlockConfirm}
        displayName={user.display_name}
        onConfirm={handleBlock}
        onClose={() => setShowBlockConfirm(false)}
      />
    </MobileGuard>
  );
}
