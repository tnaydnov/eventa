'use client';

import { useEffect, useRef } from 'react';
import SitePageLayout from '@/components/SitePageLayout';

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
  note?: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    num: '01',
    title: 'הזמינו דרך האתר',
    desc: 'מלאו את טופס ההזמנה - סוג אירוע, תאריך, רקע לאפליקציה ופוסטר כניסה מעוצב.',
    accent: 'var(--primary, #D4A59A)',
    icon: (
      <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'שלמו ואשרו',
    desc: 'לאחר שליחת ההזמנה, תקבלו מייל עם קישור לתשלום מאובטח. ברגע שהתשלום מאושר - ההזמנה נכנסת לעבודה.',
    accent: 'var(--primary-light, #E8C4BB)',
    icon: (
      <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'קבלו את הפוסטר',
    desc: 'תוך 24 שעות מאישור התשלום, נשלח לכם פוסטר מעוצב עם קוד QR + קישור הצטרפות כקובץ דיגיטלי.',
    note: 'ההדפסה והמיקום באירוע - באחריותכם. שימו בכניסה, על הבר, במסך, בסטורי - איפה שבא לכם.',
    accent: 'var(--accent-gold, #C9A580)',
    icon: (
      <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
    desc: 'האורחים סורקים את ה-QR, לוחצים על הקישור, או מקבלים הזמנה ב-WhatsApp. אימות מהיר עם קוד SMS, בניית פרופיל תוך דקה - והם בפנים. בלי הורדה, ישר מהדפדפן.',
    accent: 'var(--primary, #D4A59A)',
    icon: (
      <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12" y2="18.01" />
      </svg>
    ),
  },
  {
    num: '05',
    title: 'הקסם קורה',
    desc: 'לייקים, מאצ\'ים, וצ\'אט בין הרווקים והרווקות - הכל קורה בזמן אמת, במהלך האירוע. מי שרכש תוספת הודעות - האורחים מקבלים WhatsApp עם קישור כמה שעות לפני, ופידבק אחרי.',
    accent: 'var(--primary-light, #E8C4BB)',
    icon: (
      <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

const EVENT_TYPES = [
  { label: 'חתונות', icon: '💒' },
  { label: 'מסיבות', icon: '🎉' },
  { label: 'אירועי חברה', icon: '🏢' },
  { label: 'מיטאפים', icon: '🤝' },
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
    <SitePageLayout wide className="hiw">
      {/* ── Ambient background ── */}
      <div className="hiw__ambient" />

      {/* ── Hero heading ── */}
      <div className="hiw__hero-intro">
        <h1 className="hiw__hero-title">
          <span className="hiw__hero-line1">איך</span>
          <span className="hiw__hero-line2">Eventa עובדת?</span>
        </h1>

        <p className="hiw__hero-sub">
          מהרגע שהזמנתם ועד הלילה של האירוע -<br />
          ככה נראית החוויה, צעד אחרי צעד.
        </p>
      </div>

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
              {stage.note && <p className="hiw-stage__note">{stage.note}</p>}
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
          מלאו את טופס ההזמנה ותנו לאורחים שלכם חוויה שהם יזכרו.
        </p>
        <a href="/dating/order" className="hiw__cta-btn">
          <span>להזמנה</span>
          <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      </section>
    </SitePageLayout>
  );
}
