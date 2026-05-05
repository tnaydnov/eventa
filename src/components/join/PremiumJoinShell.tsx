'use client';

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'framer-motion';
import type { ReactNode } from 'react';

interface PremiumJoinShellProps {
  /** Stable key for the active step — drives AnimatePresence transitions. */
  stepKey: string;
  /** Optional notice rendered above the card (e.g. in-app browser warning). */
  notice?: ReactNode;
  /** Step content rendered inside the card. */
  children: ReactNode;
}

const transition: Transition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
};

const stepVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0,  scale: 1,     transition },
  exit:    { opacity: 0, y: -10, scale: 0.99, transition: { ...transition, duration: 0.22 } },
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.14 } },
};

/**
 * PremiumJoinShell
 * ────────────────
 * Stable shell for every interactive step (welcome / phone / OTP / error).
 * The background, header and card frame never remount — only the inner
 * content fades + lifts between steps, and the card height morphs smoothly
 * via Framer's layout animations.
 */
export default function PremiumJoinShell({
  stepKey,
  notice,
  children,
}: PremiumJoinShellProps) {
  const reduce = useReducedMotion();
  const variants = reduce ? reducedVariants : stepVariants;

  return (
    <div className="pj-bg" dir="rtl">
      <div className="pj-shell-stage">
        <div className="pj-shell-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            className="pj-shell-logo"
            draggable={false}
            decoding="async"
          />
        </div>

        {notice}

        <LayoutGroup>
          <motion.div
            className="pj-card"
            layout
            transition={reduce ? { duration: 0 } : { layout: transition }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stepKey}
                className="pj-card-inner"
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </div>
  );
}
