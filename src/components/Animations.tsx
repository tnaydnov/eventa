'use client';

import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

/**
 * Wraps a page/section with a fade-slide-in animation.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---- Stagger container for lists (grid cards, chat items) ---- */
const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <motion.div
      variants={staggerItem}
      className={className}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.div>
  );
}

/* ---- Like button animation ---- */
export function LikeAnimation({ liked }: { liked: boolean }) {
  return (
    <motion.div
      animate={liked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </motion.div>
  );
}

/* ---- Toast animation ---- */
export function AnimatedToast({ message }: { message: string }) {
  return (
    <motion.div
      className="toast"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {message}
    </motion.div>
  );
}

/* ---- Modal overlay animation ---- */
export function AnimatedOverlay({ children, isOpen, onClose, ariaLabel }: { children: ReactNode; isOpen: boolean; onClose: () => void; ariaLabel: string }) {
  const focusTrapRef = useFocusTrap(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <motion.div
            ref={focusTrapRef}
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
