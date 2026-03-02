'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import Image from 'next/image';
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
        className="swipe-card-inner"
      >
        {/* ── Photo ── */}
        {photos.length > 0 ? (
          <Image
            src={getPhotoUrl(photos[photoIndex].storage_path)}
            alt={participant.display_name}
            draggable={false}
            fill
            sizes="100vw"
            priority={stackIndex === 0}
            style={{ objectFit: 'cover', pointerEvents: 'none' }}
          />
        ) : (
          <div className="swipe-card-no-photo">
            <UserIcon size={80} />
          </div>
        )}

        {/* ── Photo progress bar ── */}
        {photos.length > 1 && (
          <div className="swipe-photo-progress">
            {photos.map((_, i) => (
              <div
                key={i}
                className={`swipe-photo-dot${i === photoIndex ? ' swipe-photo-dot--active' : ''}`}
              />
            ))}
          </div>
        )}

        {/* ── LIKE badge (right swipe) ── */}
        {isTop && (
          <motion.div
            className="swipe-badge swipe-badge--like"
            style={{ opacity: likeOpacity }}
          >
            LIKE
          </motion.div>
        )}

        {/* ── NOPE badge (left swipe) ── */}
        {isTop && (
          <motion.div
            className="swipe-badge swipe-badge--nope"
            style={{ opacity: nopeOpacity }}
          >
            NOPE
          </motion.div>
        )}

        {/* ── Bottom gradient + info + action buttons ── */}
        <div className="swipe-card-overlay">
          {/* Name / age / city / bio */}
          <div className="swipe-card-info">
            <div className="swipe-card-name-row">
              <span className="swipe-card-name">
                {participant.display_name}
              </span>
              {participant.age && (
                <span className="swipe-card-age">
                  {participant.age}
                </span>
              )}
            </div>
            {participant.city && (
              <div className="swipe-card-city">
                📍 {participant.city}
              </div>
            )}
            {participant.looking_for && LOOKING_FOR_LABELS[participant.looking_for] && (
              <div className="swipe-card-looking-for">
                🎯 {LOOKING_FOR_LABELS[participant.looking_for]}
              </div>
            )}
            {participant.bio && (
              <p className="swipe-card-bio">
                {participant.bio}
              </p>
            )}
          </div>

          {/* Action buttons - on the card (X left, profile center, heart right) */}
          {isTop && (
            <div dir="ltr" className="swipe-card-actions">
              {/* Skip (left) */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!isDrag()) onSwipeLeft(); }}
                aria-label="דלג"
                className="swipe-btn swipe-btn-skip"
              >
                ✕
              </button>

              {/* View profile (center, smaller) */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!isDrag()) onViewProfile(); }}
                aria-label="צפייה בפרופיל"
                className="swipe-btn swipe-btn-profile"
              >
                <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {/* Like (right) */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!isDrag()) onSwipeRight(); }}
                aria-label="לייק"
                className="swipe-btn swipe-btn-like"
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
