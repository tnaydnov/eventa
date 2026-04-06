'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/* Scroll-reveal wrapper - fades + slides children in when they enter viewport */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}

/* Floating counter with count-up appearance */
export function StatNumber({
  value,
  label,
  suffix = '',
}: {
  value: string;
  label: string;
  suffix?: string;
}) {
  return (
    <motion.div
      className="hp__stat"
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <span className="hp__stat-value">
        {value}
        {suffix && <span className="hp__stat-suffix">{suffix}</span>}
      </span>
      <span className="hp__stat-label">{label}</span>
    </motion.div>
  );
}

/* Animated feature pill */
export function FeaturePill({ children }: { children: ReactNode }) {
  return (
    <motion.span
      className="hp__feature-pill"
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.span>
  );
}
