'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { getPhotoUrl } from '@/lib/api';
import { UserIcon } from '@/components/Icons';
import { LOOKING_FOR_LABELS } from '@/lib/constants';
import type { GridParticipant } from '@/lib/store';

/* ── Constants ─────────────────────────────────────────────────── */

/** Horizontal pixels needed to trigger a swipe action. */
const SWIPE_THRESHOLD = 120;
/** How far off-screen the card flies on exit (vw). */
const EXIT_X = 400;
/** Maximum card rotation in degrees at full drag. */
const MAX_ROTATION = 14;

/* ── Props ─────────────────────────────────────────────────────── */

interface SwipeCardProps {
  participant: GridParticipant;
  /** Is this the topmost (interactive) card? */
  isTop: boolean;
  /** 0 = top, 1 = behind, 2 = furthest back. */
  stackIndex: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onViewProfile: () => void;
}

/**
 * A single draggable card in the swipe deck.
 *
 * Uses framer-motion's drag gesture (spring-based, hardware-accelerated).
 * Shows a LIKE / NOPE badge whose opacity tracks drag distance.
 *
 * Only the top card (`isTop`) receives drag events;
 * cards below render with a stacked depth effect.
 */
export default function SwipeCard({
  participant,
  isTop,
  stackIndex,
  onSwipeRight,
  onSwipeLeft,
  onViewProfile,
}: SwipeCardProps) {
  const [exiting, setExiting] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = participant.photos;

  /* ── Drag / motion values ──────────────────────────────────── */
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [-MAX_ROTATION, 0, MAX_ROTATION]);
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD * 0.6], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD * 0.6, 0], [1, 0]);

  /* ── Tap vs drag disambiguation ────────────────────────────── */
  /** Track cumulative drag distance to distinguish taps from real drags. */
  const dragDistance = useRef(0);
  const isDrag = () => dragDistance.current > 5;

  const handleDragStart = useCallback(() => {
    dragDistance.current = 0;
  }, []);

  const handleDrag = useCallback((_: unknown, info: PanInfo) => {
    dragDistance.current = Math.abs(info.offset.x);
  }, []);

  /* ── Swipe end logic ───────────────────────────────────────── */
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const offsetX = info.offset.x;

      if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
        setExiting(true);
        const direction = offsetX > 0 ? 'right' : 'left';

        // Animate card off screen, then notify parent
        x.set(offsetX); // keep current position
        setTimeout(() => {
          if (direction === 'right') onSwipeRight();
          else onSwipeLeft();
        }, 250);
      }
      // If below threshold framer-motion's dragSnapToOrigin handles the snap-back
    },
    [onSwipeRight, onSwipeLeft, x],
  );

  /* ── Photo navigation (tap left/right halves) ──────────────── */
  const handleCardTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If drag occurred, ignore
      if (isDrag()) return;

      if (photos.length <= 1) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const tapX = e.clientX - rect.left;

      if (tapX < rect.width / 2) {
        setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
      } else {
        setPhotoIndex((i) => (i + 1) % photos.length);
      }
    },
    [photos.length],
  );

  /* ── Depth effect for stacked cards ────────────────────────── */
  const stackScale = 1 - stackIndex * 0.04;
  const stackY = stackIndex * 12;

  return (
    <motion.div
      /* ── Drag config (top card only) ── */
      drag={isTop && !exiting ? 'x' : false}
      dragSnapToOrigin={!exiting}
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      /* ── Motion styles ── */
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: stackScale,
        y: stackY,
        position: 'absolute',
        inset: 0,
        zIndex: 10 - stackIndex,
        cursor: isTop ? 'grab' : 'default',
        willChange: 'transform',
      }}
      /* ── Exit animation ── */
      animate={
        exiting
          ? { x: x.get() > 0 ? EXIT_X : -EXIT_X, opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }
          : {}
      }
      /* ── Entry animation for behind cards sliding up ── */
      initial={false}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div
        onClick={handleCardTap}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          background: 'rgba(30, 30, 30, 0.9)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* ── Photo ── */}
        {photos.length > 0 ? (
          <img
            src={getPhotoUrl(photos[photoIndex].storage_path)}
            alt={participant.display_name}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(40, 40, 40, 0.9)',
            }}
          >
            <UserIcon size={80} />
          </div>
        )}

        {/* ── Photo progress bar ── */}
        {photos.length > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '16px',
              right: '16px',
              display: 'flex',
              gap: '4px',
              zIndex: 5,
            }}
          >
            {photos.map((_, i) => (
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
        )}

        {/* ── LIKE badge (right swipe) ── */}
        {isTop && (
          <motion.div
            style={{
              opacity: likeOpacity,
              position: 'absolute',
              top: '60px',
              left: '24px',
              padding: '8px 20px',
              border: '3px solid #4ade80',
              borderRadius: '12px',
              color: '#4ade80',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '2px',
              transform: 'rotate(-15deg)',
              pointerEvents: 'none',
              zIndex: 10,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            LIKE
          </motion.div>
        )}

        {/* ── NOPE badge (left swipe) ── */}
        {isTop && (
          <motion.div
            style={{
              opacity: nopeOpacity,
              position: 'absolute',
              top: '60px',
              right: '24px',
              padding: '8px 20px',
              border: '3px solid #f87171',
              borderRadius: '12px',
              color: '#f87171',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '2px',
              transform: 'rotate(15deg)',
              pointerEvents: 'none',
              zIndex: 10,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            NOPE
          </motion.div>
        )}

        {/* ── Bottom gradient + info + action buttons ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '80px 20px 20px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          }}
        >
          {/* Name / age / city / bio */}
          <div style={{ pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 700, color: '#fff' }}>
                {participant.display_name}
              </span>
              {participant.age && (
                <span style={{ fontSize: '20px', fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>
                  {participant.age}
                </span>
              )}
            </div>
            {participant.city && (
              <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)' }}>
                📍 {participant.city}
              </div>
            )}
            {participant.looking_for && LOOKING_FOR_LABELS[participant.looking_for] && (
              <div style={{
                display: 'inline-block',
                marginTop: '6px',
                padding: '3px 10px',
                borderRadius: '16px',
                background: 'rgba(212, 165, 154, 0.2)',
                border: '1px solid rgba(212, 165, 154, 0.35)',
                color: '#D4A59A',
                fontSize: '12px',
                fontWeight: 500,
              }}>
                🎯 {LOOKING_FOR_LABELS[participant.looking_for]}
              </div>
            )}
            {participant.bio && (
              <p style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.55)',
                marginTop: '6px',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {participant.bio}
              </p>
            )}
          </div>

          {/* Action buttons - on the card (X left, profile center, heart right) */}
          {isTop && (
            <div
              dir="ltr"
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '24px',
                marginTop: '16px',
                pointerEvents: 'auto',
              }}
            >
              {/* Skip (left) */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!isDrag()) onSwipeLeft(); }}
                aria-label="דלג"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  border: '2px solid rgba(248, 113, 113, 0.5)',
                  background: 'rgba(248, 113, 113, 0.12)',
                  color: '#f87171',
                  fontSize: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                ✕
              </button>

              {/* View profile (center, smaller) */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!isDrag()) onViewProfile(); }}
                aria-label="צפייה בפרופיל"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {/* Like (right) */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!isDrag()) onSwipeRight(); }}
                aria-label="לייק"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  border: '2px solid rgba(74, 222, 128, 0.5)',
                  background: 'rgba(74, 222, 128, 0.12)',
                  color: '#4ade80',
                  fontSize: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                ♥
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
