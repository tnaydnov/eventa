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

/**
 * Content variants — animate only the inner content, not the card shell.
 * mode="popLayout": exiting content is pulled from flow so the card height
 * morphs smoothly while the new content fades in simultaneously.
 */
const contentVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -5, transition: { duration: 0.16, ease: 'easeIn' } },
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

export default function PremiumJoinShell({
  stepKey,
  notice,
  children,
}: PremiumJoinShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedVariants : contentVariants;

  return (
    <div className="pj-bg" dir="rtl">
      <div className="pj-shell-stage">
        <div className="pj-shell-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            className="pj-shell-logo"
            width={96}
            height={96}
            draggable={false}
            decoding="async"
          />
        </div>

        {notice}

        {/* Card stays stable; only the inner content crossfades between steps */}
        <motion.div
          className="pj-card"
          layout
          transition={{ layout: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={stepKey}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
