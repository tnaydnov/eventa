'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import ComingSoonCard from './ComingSoonCard';

interface ServiceDetail {
  id: string;
  title: string;
  subtitle: string;
  valueLine: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  status: 'coming-soon' | 'in-progress';
  bullets: string[];
  closingMessage: string;
  preview: React.ReactNode;
}

const SERVICES: ServiceDetail[] = [
  {
    id: 'wishes',
    title: 'Eventa Wishes',
    subtitle: 'ברכות אישיות מהאורחים - ישירות לזוג',
    valueLine: 'הופכים את הברכות לזיכרון שלא הולך לאיבוד',
    description:
      'סרקו QR והשאירו הודעה, קול או וידאו - מזכרת מרגשת שנשארת אחרי האירוע.',
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
      'האורחים משאירים ברכות אישיות בקלות',
      'סריקה מהירה דרך QR - בלי אפליקציה',
      'כל הברכות נשמרות לאלבום דיגיטלי אחד',
    ],
    closingMessage: 'זה הולך להיות אחד הרגעים הכי מרגשים באירוע שלך',
    preview: (
      <div className="hp__sheet-preview hp__sheet-preview--wishes">
        <div className="hp__preview-phone">
          <div className="hp__preview-screen">
            <div className="hp__preview-rec" aria-hidden="true">
              <span className="hp__preview-rec-dot" />
              <span>מקליטים ברכה...</span>
            </div>
            <div className="hp__preview-wave" aria-hidden="true">
              {[40, 65, 30, 80, 55, 70, 35, 60, 45, 75, 50, 68].map((h, i) => (
                <span key={i} className="hp__preview-wave-bar" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
            <div className="hp__preview-label">💛 ברכה מ-דנה ורונן</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'rides',
    title: 'Eventa Rides',
    subtitle: 'מתחברים לנסיעות לאירוע ובחזרה',
    valueLine: 'אף אורח לא נתקע בדרך - גם לא בחזרה',
    description:
      'נהגים ונוסעים נפגשים לפי אזור ושעה - כולל חזרה בטוחה אחרי האירוע.',
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
    badge: '🚧 בפיתוח',
    status: 'coming-soon',
    bullets: [
      'חיבור חכם בין נהגים לנוסעים',
      'תיאום נסיעות הלוך וחזור',
      'חזרה בטוחה מהאירוע גם אחרי אלכוהול',
    ],
    closingMessage: 'בקרוב - הדרך לאירוע תהיה חלק מהחוויה',
    preview: (
      <div className="hp__sheet-preview hp__sheet-preview--rides">
        <div className="hp__preview-route">
          <div className="hp__preview-route-line" aria-hidden="true" />
          <div className="hp__preview-stop">
            <span className="hp__preview-stop-dot hp__preview-stop-dot--start" />
            <span className="hp__preview-stop-text">
              <span className="hp__preview-stop-label">איסוף</span>
              <span className="hp__preview-stop-detail">תל אביב, 19:00</span>
            </span>
          </div>
          <div className="hp__preview-riders" aria-hidden="true">
            <span className="hp__preview-avatar">ד</span>
            <span className="hp__preview-avatar">ש</span>
            <span className="hp__preview-avatar">+2</span>
          </div>
          <div className="hp__preview-stop">
            <span className="hp__preview-stop-dot hp__preview-stop-dot--end" />
            <span className="hp__preview-stop-text">
              <span className="hp__preview-stop-label">האירוע</span>
              <span className="hp__preview-stop-detail">אולמי הגן, ראשל״צ</span>
            </span>
          </div>
        </div>
      </div>
    ),
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
      transition={{ duration: 0.25 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`פרטים על ${service.title}`}
    >
      <motion.div
        ref={focusTrapRef}
        className="hp__soon-sheet"
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="hp__soon-sheet-handle" aria-hidden="true" />

        <motion.div
          className="hp__soon-sheet-icon"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {service.icon}
        </motion.div>
        <h3 className="hp__soon-sheet-title">{service.title}</h3>
        <p className="hp__soon-sheet-value">{service.valueLine}</p>

        {/* Preview mock */}
        {service.preview}

        <ul className="hp__soon-sheet-bullets">
          {service.bullets.map((bullet, idx) => (
            <motion.li
              key={bullet}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + idx * 0.08, duration: 0.3 }}
            >
              <span className="hp__soon-bullet-dot" aria-hidden="true" />
              {bullet}
            </motion.li>
          ))}
        </ul>

        <p className="hp__soon-sheet-closing">{service.closingMessage}</p>

        <div className="hp__soon-sheet-actions">
          <button
            type="button"
            className="hp__soon-sheet-cta"
            onClick={onClose}
          >
            זה מעניין אותי
          </button>
          <button
            type="button"
            className="hp__soon-sheet-close"
            onClick={onClose}
          >
            סגירה
          </button>
        </div>
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
          <span className="hp__coming-tag">עוד חוויות בדרך - כל אחת משנה את האירוע</span>
          <div className="hp__coming-line" />
        </div>

        <div className="hp__coming-grid">
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
        </div>
      </div>

      <AnimatePresence>
        {activeService && (
          <ServiceModal service={activeService} onClose={handleClose} />
        )}
      </AnimatePresence>
    </>
  );
}
