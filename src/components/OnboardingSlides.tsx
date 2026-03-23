'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Onboarding slide data */
interface Slide {
  icon: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: '⏱',
    title: 'זמינות האפליקציה',
    body: 'האפליקציה פעילה במהלך האירוע ועד 7 ימים לאחריו.\nלאחר מכן כל המידע והפרופילים נמחקים באופן אוטומטי ולא ניתן יהיה להיכנס יותר.',
  },
  {
    icon: '✏️',
    title: 'שליטה בפרופיל',
    body: 'ניתן לשנות את כל פרטי הפרופיל וההעדפות בכל רגע דרך עמוד הפרופיל.\n\nניתן גם למחוק את הפרופיל בכל רגע.\nהמחיקה מסירה את הפרופיל מכל המשתמשים ומוחקת את כל המידע הקשור אליו.',
  },
  {
    icon: '🚫',
    title: 'בטיחות וחסימה',
    body: 'ניתן לחסום כל משתמש דרך הפרופיל שלו.\nהחסימה תגרום לכך שלא תראו יותר אחד את השני, וכל האינטראקציות ביניכם (שיחות, לייקים וכו׳) יימחקו.',
  },
];

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' as const },
  }),
};

interface OnboardingSlidesProps {
  /** Called when the user finishes all slides */
  onComplete: () => void;
}

export default function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const isLast = current === SLIDES.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setDirection(1);
      setCurrent((i) => i + 1);
    }
  }, [isLast, onComplete]);

  const goBack = useCallback(() => {
    if (current > 0) {
      setDirection(-1);
      setCurrent((i) => i - 1);
    }
  }, [current]);

  const slide = SLIDES[current];

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="מדריך הכרות עם Eventa">
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <h2 style={styles.welcomeTitle}>ברוכים הבאים ל-Eventa</h2>
            <p style={styles.welcomeSubtitle}>
              הכירו אנשים במהלך האירוע בצורה נעימה ובטוחה
            </p>
          </motion.div>
        </div>

        {/* Slide content */}
        <div style={styles.slideArea}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={styles.slideContent}
            >
              <span style={styles.slideIcon}>{slide.icon}</span>
              <h3 style={styles.slideTitle}>{slide.title}</h3>
              <p style={styles.slideBody}>
                {slide.body.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < slide.body.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div style={styles.dots}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                ...(i === current ? styles.dotActive : {}),
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={styles.buttons}>
          {current > 0 ? (
            <button
              type="button"
              onClick={goBack}
              style={styles.backBtn}
            >
              חזרה
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={goNext}
            className="btn btn-primary"
            style={styles.nextBtn}
          >
            {isLast ? 'בואו נתחיל! 🎉' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline styles (matches design system) ─── */

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  header: {
    textAlign: 'center',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--primary)',
    margin: 0,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginTop: 6,
    lineHeight: 1.5,
  },
  slideArea: {
    width: '100%',
    minHeight: 240,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slideContent: {
    width: '100%',
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: 16,
    padding: '28px 24px',
    textAlign: 'center',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  slideIcon: {
    fontSize: 36,
    display: 'block',
    marginBottom: 12,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: '0 0 12px',
  },
  slideBody: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    margin: 0,
    textAlign: 'right',
  },
  dots: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    transition: 'all 0.3s ease',
  },
  dotActive: {
    background: 'var(--primary)',
    width: 24,
    borderRadius: 4,
  },
  buttons: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    padding: '8px 4px',
  },
  nextBtn: {
    minWidth: 140,
    fontSize: 15,
    fontWeight: 600,
    padding: '12px 24px',
  },
};
