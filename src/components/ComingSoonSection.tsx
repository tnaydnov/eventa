'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import ComingSoonCard from './ComingSoonCard';

interface ServiceDetail {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  status: 'coming-soon' | 'in-progress';
  bullets: string[];
  closingMessage: string;
}

const SERVICES: ServiceDetail[] = [
  {
    id: 'wishes',
    title: 'Eventa Wishes',
    subtitle: 'ברכות אישיות מהאורחים - ישירות לזוג',
    description:
      'האורחים סורקים QR באירוע, מקליטים ברכה, מצלמים סרטון או כותבים הודעה - והכל נשמר לזוג במקום אחד.',
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.77 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z" />
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" opacity="0.4" />
      </svg>
    ),
    badge: 'חדש ✨',
    status: 'in-progress',
    bullets: [
      'העלאת ברכות בוידאו/טקסט',
      'סריקה פשוטה דרך QR',
      'אלבום דיגיטלי לזוג אחרי האירוע',
    ],
    closingMessage: 'השירות נמצא בפיתוח ויעלה בקרוב!',
  },
  {
    id: 'rides',
    title: 'Eventa Rides',
    subtitle: 'מתחברים לנסיעות - הלוך וחזור',
    description:
      'חיבור בין נהגים לנוסעים לפי אזור, שעה וכיוון - כולל חזרה בטוחה מהאירוע אחרי אלכוהול.',
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 17h2m10 0h2M2 9l2-6h16l2 6M2 9h20v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
    badge: 'בקרוב',
    status: 'coming-soon',
    bullets: [
      'חיבור חכם לפי אזור וכיוון נסיעה',
      'תיאום חזרה בטוחה מהאירוע',
      'ניהול נסיעות פשוט דרך הדפדפן',
    ],
    closingMessage: 'זה יעלה בקרוב - הישארו מעודכנים!',
  },
];

function ServiceModal({
  service,
  onClose,
}: {
  service: ServiceDetail;
  onClose: () => void;
}) {
  const focusTrapRef = useFocusTrap(true, onClose);

  return (
    <motion.div
      className="hp__soon-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`פרטים על ${service.title}`}
    >
      <motion.div
        ref={focusTrapRef}
        className="hp__soon-sheet"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="hp__soon-sheet-handle" aria-hidden="true" />

        <div className="hp__soon-sheet-icon">{service.icon}</div>
        <h3 className="hp__soon-sheet-title">{service.title}</h3>
        <p className="hp__soon-sheet-subtitle">{service.subtitle}</p>

        <ul className="hp__soon-sheet-bullets">
          {service.bullets.map((bullet) => (
            <li key={bullet}>
              <span className="hp__soon-bullet-dot" aria-hidden="true" />
              {bullet}
            </li>
          ))}
        </ul>

        <p className="hp__soon-sheet-closing">{service.closingMessage}</p>

        <button
          type="button"
          className="hp__soon-sheet-close"
          onClick={onClose}
        >
          סגירה
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function ComingSoonSection() {
  const [activeService, setActiveService] = useState<ServiceDetail | null>(null);

  const handleClose = useCallback(() => setActiveService(null), []);

  return (
    <>
      <div className="hp__coming">
        <div className="hp__coming-header">
          <div className="hp__coming-line" />
          <span className="hp__coming-tag">ויש עוד בדרך...</span>
          <div className="hp__coming-line" />
        </div>

        <motion.div
          className="hp__coming-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={{
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          {SERVICES.map((service) => (
            <ComingSoonCard
              key={service.id}
              title={service.title}
              subtitle={service.subtitle}
              description={service.description}
              icon={service.icon}
              status={service.status}
              badge={service.badge}
              onClick={() => setActiveService(service)}
            />
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {activeService && (
          <ServiceModal service={activeService} onClose={handleClose} />
        )}
      </AnimatePresence>
    </>
  );
}
