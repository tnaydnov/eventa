'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

/**
 * /how-it-works
 * A visually-rich journey page showing event organizers
 * exactly how Eventa works - from first contact to event night.
 * Uses a vertical "path" with scroll-reveal stages.
 */

/* ── Stage data ── */
const STAGES: {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    num: '01',
    title: 'פנו אלינו',
    desc: 'ספרו לנו על האירוע - סוג, תאריך, כמות מוזמנים ומה שחשוב לכם. נחזור תוך 24 שעות עם הצעה מותאמת.',
    accent: 'var(--primary, #D4A59A)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'התאימו את החוויה',
    desc: 'בחרו עיצוב לדף הכניסה של האירוע, רקע מותאם לאפליקציה, ואם תרצו - שירות שליחת הודעות לאורחים ביום האירוע.',
    accent: 'var(--primary-light, #E8C4BB)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'קבלו את ה-QR',
    desc: 'נשלח לכם קוד QR ייחודי לאירוע + לינק ישיר. תדפיסו את הדף, תשימו בכניסה, על הבר, בסטורי - איפה שתרצו.',
    accent: 'var(--accent-gold, #C9A580)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="3" height="3" />
        <line x1="21" y1="14" x2="21" y2="14.01" />
        <line x1="21" y1="21" x2="21" y2="21.01" />
        <line x1="17" y1="21" x2="17" y2="21.01" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'האורחים סורקים ונכנסים',
    desc: 'האורחים סורקים את ה-QR, בונים פרופיל תוך דקה (שם, תמונה, ביו קצר) - והם בפנים. בלי הורדה, ישר מהדפדפן.',
    accent: 'var(--primary, #D4A59A)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12" y2="18.01" />
      </svg>
    ),
  },
  {
    num: '05',
    title: 'הקסם קורה',
    desc: 'לייקים, מאצ\'ים, וצ\'אט בין הרווקים והרווקות - הכל קורה בזמן אמת, במהלך האירוע. חוויה שיוצרת באזז אמיתי.',
    accent: 'var(--primary-light, #E8C4BB)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    num: '06',
    title: 'הכל נמחק - פרטיות מלאה',
    desc: 'תוך 7 ימים מסיום האירוע, כל המידע האישי נמחק אוטומטית. בלי מעקב, בלי פרסומות, בלי שיתוף עם צד שלישי.',
    accent: 'var(--accent-gold, #C9A580)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

const EVENT_TYPES = [
  { label: 'חתונות', icon: '💒' },
  { label: 'בר/בת מצווה', icon: '🎉' },
  { label: 'מסיבות', icon: '🎶' },
  { label: 'אירועי חברה', icon: '🏢' },
  { label: 'אירועים פרטיים', icon: '🥂' },
  { label: 'ועוד...', icon: '✨' },
];

export default function HowItWorksPage() {
  const pathRef = useRef<HTMLDivElement>(null);

  /* ── Scroll-reveal observer ── */
  useEffect(() => {
    const container = pathRef.current;
    if (!container) return;

    const stages = container.querySelectorAll('.hiw-stage');
    if (!stages.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('hiw-stage--visible');
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -60px 0px' }
    );

    stages.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="hiw">
      {/* ── Ambient background ── */}
      <div className="hiw__ambient" />

      {/* ── Hero ── */}
      <header className="hiw__hero">
        <a href="/dating" className="hiw__back" aria-label="חזרה">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>

        <div className="hiw__hero-logo">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={80}
            height={80}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        <h1 className="hiw__hero-title">
          <span className="hiw__hero-line1">איך</span>
          <span className="hiw__hero-line2">Eventa עובדת?</span>
        </h1>

        <p className="hiw__hero-sub">
          מהרגע שפניתם ועד הלילה של האירוע -<br />
          ככה נראית החוויה, צעד אחרי צעד.
        </p>
      </header>

      {/* ── Event types ribbon ── */}
      <section className="hiw__types">
        <p className="hiw__types-label">מתאים לכל סוגי האירועים</p>
        <div className="hiw__types-row">
          {EVENT_TYPES.map((t) => (
            <div key={t.label} className="hiw__type-chip">
              <span className="hiw__type-icon">{t.icon}</span>
              <span className="hiw__type-text">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── The journey path ── */}
      <section className="hiw__path" ref={pathRef}>
        {/* Connecting vertical line */}
        <div className="hiw__path-line" aria-hidden="true" />

        {STAGES.map((stage, i) => (
          <div key={stage.num} className="hiw-stage" style={{ '--stage-accent': stage.accent } as React.CSSProperties}>
            {/* Timeline node */}
            <div className="hiw-stage__node">
              <div className="hiw-stage__dot">
                {stage.icon}
              </div>
              {i < STAGES.length - 1 && <div className="hiw-stage__connector" />}
            </div>

            {/* Content card */}
            <div className="hiw-stage__content">
              <span className="hiw-stage__num">{stage.num}</span>
              <h2 className="hiw-stage__title">{stage.title}</h2>
              <p className="hiw-stage__desc">{stage.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Bottom CTA ── */}
      <section className="hiw__cta">
        <div className="hiw__cta-glow" />
        <h2 className="hiw__cta-title">
          מוכנים להוסיף <span className="hiw__cta-gradient">שכבת היכרויות</span> לאירוע?
        </h2>
        <p className="hiw__cta-sub">
          פנו אלינו היום ותנו לאורחים שלכם חוויה שהם יזכרו.
        </p>
        <a href="/dating#order" className="hiw__cta-btn">
          <span>בואו נתחיל</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      </section>

      {/* ── Footer ── */}
      <footer className="hiw__footer">
        <p>© {new Date().getFullYear()} Eventa. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
}
