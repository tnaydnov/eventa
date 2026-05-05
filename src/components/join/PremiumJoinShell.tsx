'use client';

import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface PremiumJoinShellProps {
  /** Stable key for the active step - drives AnimatePresence transitions. */
  stepKey: string;
  /** Optional notice rendered above the card (e.g. in-app browser warning). */
  notice?: ReactNode;
  /** Step content rendered inside the glass card. */
  children: ReactNode;
}

const cardVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' } },
};

const reducedVariants: Variants = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 1, y: 0 },
};

/**
 * PremiumJoinShell
 * ────────────────
 * Shared luxury shell for every interactive step of the QR-join flow
 * (welcome, phone, OTP). Provides:
 *   - the same dark radial-glow background as the splash
 *   - safe-area-aware mobile padding
 *   - consistent Eventa header (logo + script wordmark)
 *   - a glass card frame
 *   - motion-driven step transitions via AnimatePresence (respects reduced motion)
 */
export default function PremiumJoinShell({
  stepKey,
  notice,
  children,
}: PremiumJoinShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedVariants : cardVariants;

  return (
    <div className="pj-bg" dir="rtl">
      <div className="pj-shell-stage">
        <div className="pj-shell-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            className="pj-shell-logo"
            width={76}
            height={76}
            draggable={false}
            decoding="async"
          />
          <h2 className="pj-shell-brand">Eventa</h2>
        </div>

        {notice}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepKey}
            className="pj-card"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
