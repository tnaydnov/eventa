'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useMatchStore, useSessionStore } from '@/lib/store';
import { getOrCreateConversation, getPhotoUrl } from '@/lib/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Fullscreen "It's a Match!" popup.
 *
 * Mounted once in the event layout. Reads `pendingMatch` from the
 * match store and renders an animated overlay with:
 * - Both users' photos (mine + theirs)
 * - The matched person's name
 * - A "Send Message" CTA button
 * - A dismiss/close option
 *
 * Hearts rain animation provides the emotional dopamine hit.
 */
export default function MatchPopup() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const pendingMatch = useMatchStore((s) => s.pendingMatch);
  const clearPendingMatch = useMatchStore((s) => s.clearPendingMatch);
  const [navigating, setNavigating] = useState(false);

  const handleDismiss = useCallback(() => {
    clearPendingMatch();
  }, [clearPendingMatch]);

  const focusTrapRef = useFocusTrap(!!pendingMatch, handleDismiss);

  // Derive my photo from session store photos (user's own uploaded photos)
  const myPhotos = useSessionStore((s) => s.photos);
  const myPhotoUrl = myPhotos?.[0]?.storage_path
    ? getPhotoUrl(myPhotos[0].storage_path, { width: 480, height: 640, quality: 80 })
    : null;

  const handleSendMessage = useCallback(async () => {
    if (!session || !pendingMatch || navigating) return;
    setNavigating(true);

    try {
      const conv = await getOrCreateConversation(pendingMatch.id);
      clearPendingMatch();

      if (conv) {
        router.push(`/${session.eventSlug}/chat/${conv.id}`);
      }
    } catch (err) {
      console.error('[MatchPopup] Failed to create conversation:', err);
      clearPendingMatch();
    } finally {
      setNavigating(false);
    }
  }, [session, pendingMatch, navigating, clearPendingMatch, router]);

  // Don't show popup if no pending match
  if (!pendingMatch) return null;

  return (
    <AnimatePresence>
      {pendingMatch && (
        <motion.div
          key="match-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '24px',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="התאמה חדשה"
          onClick={handleDismiss}
        >
          {/* Hearts rain background */}
          <HeartsRain />

          {/* Content - prevent click-through to backdrop dismiss */}
          <motion.div
            ref={focusTrapRef}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              maxWidth: '340px',
              width: '100%',
            }}
          >
            {/* Title */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                fontSize: '36px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--primary), #ff6b9d)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px',
                lineHeight: 1.2,
              }}>
                !It&apos;s a Match
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '15px',
                marginTop: '8px',
              }}>
                גם {pendingMatch.displayName} עשו לך לייק!
              </p>
            </motion.div>

            {/* Photo pair */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.3 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0',
                position: 'relative',
              }}
            >
              {/* My photo */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid var(--primary)',
                background: 'var(--card-bg)',
                position: 'relative',
                zIndex: 2,
              }}>
                {myPhotoUrl ? (
                  <img
                    src={myPhotoUrl}
                    alt="את/ה"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '40px',
                    color: 'var(--text-muted)',
                  }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Heart bridge */}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  zIndex: 3,
                  background: 'var(--primary)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  boxShadow: '0 0 20px rgba(225, 180, 180, 0.5)',
                }}
                aria-hidden="true"
              >
                💗
              </motion.div>

              {/* Their photo */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid var(--primary)',
                background: 'var(--card-bg)',
                position: 'relative',
                zIndex: 1,
                marginLeft: '-16px',
              }}>
                {pendingMatch.photoUrl ? (
                  <img
                    src={pendingMatch.photoUrl}
                    alt={pendingMatch.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                width: '100%',
                marginTop: '8px',
              }}
            >
              <button
                onClick={handleSendMessage}
                disabled={navigating}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, var(--primary), #ff6b9d)',
                  border: 'none',
                  borderRadius: '14px',
                  color: '#1a1a1a',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: navigating ? 'wait' : 'pointer',
                  opacity: navigating ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                שלח/י הודעה
              </button>

              <button
                onClick={handleDismiss}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  minHeight: '44px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '14px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                המשך לגלול
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Hearts rain animation ─────────────────────────────────────── */

/** Generates floating heart particles for the match celebration. */
function HeartsRain() {
  // Memoize so random positions don't change on every re-render
  const hearts = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3,
        size: 12 + Math.random() * 16,
        opacity: 0.3 + Math.random() * 0.5,
      })),
    [],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {hearts.map((h) => (
        <motion.div
          key={h.id}
          initial={{ y: '-10%', x: 0, opacity: 0 }}
          animate={{
            y: '110%',
            x: [0, 15, -15, 0],
            opacity: [0, h.opacity, h.opacity, 0],
          }}
          transition={{
            duration: h.duration,
            delay: h.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            left: h.left,
            fontSize: `${h.size}px`,
            willChange: 'transform',
          }}
        >
          <span aria-hidden="true">💗</span>
        </motion.div>
      ))}
    </div>
  );
}
