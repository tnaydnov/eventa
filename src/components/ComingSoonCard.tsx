'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ComingSoonCardProps {
  title: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  status: 'coming-soon' | 'in-progress';
  badge: string;
  onClick?: () => void;
}

export default function ComingSoonCard({
  title,
  subtitle,
  description,
  icon,
  status,
  badge,
  onClick,
}: ComingSoonCardProps) {
  const isInProgress = status === 'in-progress';

  return (
    <motion.button
      type="button"
      className={`hp__card hp__card--soon-interactive ${isInProgress ? 'hp__card--in-progress' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Glow border layer */}
      <span className="hp__soon-glow" aria-hidden="true" />

      <span
        className={`hp__card-status ${isInProgress ? 'hp__card-status--progress' : 'hp__card-status--soon'}`}
      >
        {isInProgress && <span className="hp__card-dot hp__card-dot--purple" />}
        <span>{badge}</span>
      </span>

      <span className="hp__card-icon hp__card-icon--soon-new">
        {icon}
      </span>

      <span className="hp__card-title hp__card-title--sm">{title}</span>
      <span className="hp__card-subtitle">{subtitle}</span>
      <span className="hp__card-desc hp__card-desc--sm">{description}</span>

      <span className="hp__soon-tap-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        גלו עוד
      </span>
    </motion.button>
  );
}
