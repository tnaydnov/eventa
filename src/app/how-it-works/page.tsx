'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import SitePageLayout from '@/components/SitePageLayout';

/* ═══════════════════════════════════════════
   Data — Two journeys, each with steps
   ═══════════════════════════════════════════ */

type Step = {
  title: string;
  desc: string;
  /** Which phone screen mockup to show */
  screen: string;
};

const ORGANIZER_STEPS: Step[] = [
  {
    title: 'ממלאים טופס הזמנה',
    desc: 'בוחרים סוג אירוע, תאריך, רקע מותאם, ואם לשלוח הודעות WhatsApp לאורחים. הכל בטופס אחד פשוט.',
    screen: 'org-form',
  },
  {
    title: 'משלמים באופן מאובטח',
    desc: 'תשלום מיידי דרך האתר — כרטיס אשראי או BIT. ברגע שהתשלום עובר, אנחנו מתחילים לעבוד.',
    screen: 'org-pay',
  },
  {
    title: 'מקבלים פוסטר QR מעוצב',
    desc: 'תוך 48 שעות תקבלו למייל פוסטר מוכן להדפסה עם קוד QR וקישור — מותאם לסגנון האירוע שלכם.',
    screen: 'org-poster',
  },
  {
    title: 'שולחים הודעות לאורחים',
    desc: 'בחרתם לשלוח? העלו רשימת טלפונים ואנחנו שולחים הודעת WhatsApp עם קישור הצטרפות. לא בחרתם? הפוסטר עושה את העבודה.',
    screen: 'org-whatsapp',
  },
  {
    title: 'מציבים את הפוסטר באירוע',
    desc: 'בכניסה, על הבר, על מסך — אתם בוחרים. האורחים סורקים ומצטרפים תוך שניות. הכל מוכן.',
    screen: 'org-place',
  },
];

const GUEST_STEPS: Step[] = [
  {
    title: 'רואים את הפוסטר',
    desc: 'מגיעים לאירוע, רואים פוסטר מעוצב עם קוד QR. סורקים עם המצלמה או לוחצים על קישור — בלי להוריד שום אפליקציה.',
    screen: 'guest-scan',
  },
  {
    title: 'נרשמים תוך דקה',
    desc: 'אימות מהיר עם SMS, בוחרים תמונה, שם, גיל ומשפט קצר. הפרופיל מוכן — ואתם בפנים.',
    screen: 'guest-register',
  },
  {
    title: 'מגלים מי פה',
    desc: 'רואים את כל הרווקים והרווקות באירוע. גוללים בגריד, עוברים על פרופילים, מוצאים מישהו שתופס את העין.',
    screen: 'guest-discover',
  },
  {
    title: 'עושים לייק ומקבלים מאצ\'',
    desc: 'לחצתם על הלב? אם גם הצד השני לחץ — יש מאצ\'! הכל אנונימי עד שזה הדדי. בלי מבוכה.',
    screen: 'guest-match',
  },
  {
    title: 'שולחים הודעה ונפגשים',
    desc: 'אחרי מאצ\' נפתח צ\'אט פרטי. שלחו הודעה, תאמו מפגש — הם ממש שם, באותו אירוע.',
    screen: 'guest-chat',
  },
  {
    title: 'הכל נמחק. פרטיות מלאה.',
    desc: '7 ימים אחרי האירוע כל המידע נמחק אוטומטית. בלי מעקב, בלי פרסומות, בלי עקבות. רק הרגע.',
    screen: 'guest-privacy',
  },
];

type Journey = 'organizer' | 'guest';

/* ═══════════════════════════════════════════
   Phone screen mockups (CSS-only)
   ═══════════════════════════════════════════ */

function PhoneScreen({ screen }: { screen: string }) {
  switch (screen) {
    /* ── Organizer screens ── */
    case 'org-form':
      return (
        <div className="hps hps--form">
          <div className="hps__bar">טופס הזמנה</div>
          <div className="hps__fields">
            <div className="hps__field"><span className="hps__label">סוג אירוע</span><span className="hps__val">חתונה 💒</span></div>
            <div className="hps__field"><span className="hps__label">תאריך</span><span className="hps__val">15.06.2026</span></div>
            <div className="hps__field"><span className="hps__label">שם האירוע</span><span className="hps__val">החתונה של דנה ואור</span></div>
            <div className="hps__field"><span className="hps__label">רקע</span><span className="hps__val hps__val--img">🌅 Into the Sunset</span></div>
            <div className="hps__field"><span className="hps__label">הודעות WhatsApp</span><span className="hps__val hps__val--toggle">✓</span></div>
          </div>
          <div className="hps__btn">המשך</div>
        </div>
      );
    case 'org-pay':
      return (
        <div className="hps hps--pay">
          <div className="hps__bar">תשלום מאובטח</div>
          <div className="hps__pay-amount">₪300</div>
          <div className="hps__pay-label">תשלום חד-פעמי · הכל כלול</div>
          <div className="hps__pay-methods">
            <div className="hps__pay-method hps__pay-method--active">💳 כרטיס אשראי</div>
            <div className="hps__pay-method">📱 BIT</div>
          </div>
          <div className="hps__fields hps__fields--sm">
            <div className="hps__field"><span className="hps__label">מספר כרטיס</span><span className="hps__val">•••• •••• •••• 4242</span></div>
            <div className="hps__field"><span className="hps__label">תוקף</span><span className="hps__val">09/28</span></div>
          </div>
          <div className="hps__btn hps__btn--glow">שלמו ₪300</div>
        </div>
      );
    case 'org-poster':
      return (
        <div className="hps hps--poster">
          <div className="hps__bar">הפוסטר שלכם מוכן! ✨</div>
          <div className="hps__poster-preview">
            <div className="hps__poster-card">
              <div className="hps__poster-title">החתונה של דנה ואור</div>
              <div className="hps__poster-qr">
                <div className="hps__qr-box" aria-label="QR code mockup">
                  {/* 5×5 grid QR mockup */}
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className={`hps__qr-cell${[0,1,3,4,5,9,10,14,15,19,20,21,23,24].includes(i) ? ' hps__qr-cell--on' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="hps__poster-sub">סרקו להצטרפות</div>
            </div>
          </div>
          <div className="hps__poster-actions">
            <div className="hps__btn hps__btn--sm">📥 הורדה</div>
            <div className="hps__btn hps__btn--sm hps__btn--outline">📤 שיתוף</div>
          </div>
        </div>
      );
    case 'org-whatsapp':
      return (
        <div className="hps hps--wa">
          <div className="hps__bar hps__bar--green">WhatsApp הודעות</div>
          <div className="hps__wa-preview">
            <div className="hps__wa-bubble">
              <div className="hps__wa-sender">Eventa</div>
              <div className="hps__wa-text">היי! 🎉 הוזמנתם לחתונה של דנה ואור. לחצו על הקישור להצטרפות לשכבת ההיכרויות:</div>
              <div className="hps__wa-link">eventa.productions/join/abc123</div>
              <div className="hps__wa-time">10:30 ✓✓</div>
            </div>
          </div>
          <div className="hps__wa-stats">
            <div className="hps__wa-stat"><span className="hps__wa-stat-n">148</span>הודעות נשלחו</div>
            <div className="hps__wa-stat"><span className="hps__wa-stat-n">142</span>נקראו</div>
          </div>
        </div>
      );
    case 'org-place':
      return (
        <div className="hps hps--place">
          <div className="hps__bar">הכל מוכן! 🎯</div>
          <div className="hps__place-visual">
            <div className="hps__place-poster-icon">📋</div>
            <div className="hps__place-arrows">
              <span>🏛️ כניסה</span>
              <span>🍸 בר</span>
              <span>📺 מסך</span>
            </div>
          </div>
          <div className="hps__place-tip">הציבו את הפוסטר במקום בולט — האורחים סורקים ומצטרפים תוך שניות</div>
          <div className="hps__place-status">
            <div className="hps__place-dot" />
            <span>האירוע פעיל</span>
          </div>
        </div>
      );

    /* ── Guest screens ── */
    case 'guest-scan':
      return (
        <div className="hps hps--scan">
          <div className="hps__scan-viewfinder">
            <div className="hps__scan-corners" />
            <div className="hps__scan-line" />
          </div>
          <div className="hps__scan-text">סרקו את קוד ה-QR</div>
          <div className="hps__scan-hint">או לחצו על הקישור</div>
        </div>
      );
    case 'guest-register':
      return (
        <div className="hps hps--register">
          <div className="hps__bar">הצטרפות מהירה</div>
          <div className="hps__reg-avatar">
            <div className="hps__reg-avatar-circle">📷</div>
          </div>
          <div className="hps__fields">
            <div className="hps__field"><span className="hps__label">שם</span><span className="hps__val">נועה</span></div>
            <div className="hps__field"><span className="hps__label">גיל</span><span className="hps__val">24</span></div>
            <div className="hps__field"><span className="hps__label">עיר</span><span className="hps__val">תל אביב</span></div>
            <div className="hps__field"><span className="hps__label">קצת עליי</span><span className="hps__val">אוהבת ריקודים 🍷</span></div>
          </div>
          <div className="hps__btn">בואו נתחיל!</div>
        </div>
      );
    case 'guest-discover':
      return (
        <div className="hps hps--discover">
          <div className="hps__bar">מי כאן? 👀</div>
          <div className="hps__grid-mock">
            {['נועה,24', 'איתי,27', 'מאיה,25', 'דניאל,28', 'שיר,23', 'עומר,26', 'תמר,25', 'יונתן,29', 'ליאור,24'].map((u, i) => {
              const [name, age] = u.split(',');
              return (
                <div key={i} className="hps__grid-item">
                  <div className="hps__grid-avatar" style={{ background: `hsl(${i * 40}, 40%, 45%)` }} />
                  <span className="hps__grid-name">{name}, {age}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    case 'guest-match':
      return (
        <div className="hps hps--match">
          <div className="hps__match-celebration">
            <div className="hps__match-hearts">
              <span>💕</span><span>✨</span><span>💕</span>
            </div>
            <div className="hps__match-title">יש מאצ׳!</div>
            <div className="hps__match-pair">
              <div className="hps__match-avatar" style={{ background: 'hsl(350, 50%, 55%)' }}>נ</div>
              <div className="hps__match-heart-icon">❤️</div>
              <div className="hps__match-avatar" style={{ background: 'hsl(200, 45%, 50%)' }}>ד</div>
            </div>
            <div className="hps__match-names">נועה ודניאל</div>
            <div className="hps__btn">שלחו הודעה</div>
          </div>
        </div>
      );
    case 'guest-chat':
      return (
        <div className="hps hps--chat">
          <div className="hps__bar">דניאל 💬</div>
          <div className="hps__chat-messages">
            <div className="hps__chat-msg hps__chat-msg--received">היי נועה! 😊</div>
            <div className="hps__chat-msg hps__chat-msg--sent">היי! איזה כיף שעשינו מאצ׳</div>
            <div className="hps__chat-msg hps__chat-msg--received">ממש! איפה את באירוע?</div>
            <div className="hps__chat-msg hps__chat-msg--sent">ליד הבר 🍸 בואו נפגש!</div>
            <div className="hps__chat-msg hps__chat-msg--received">בדרך! 🏃‍♂️</div>
          </div>
          <div className="hps__chat-input">
            <span>הקלידו הודעה...</span>
            <span className="hps__chat-send">➤</span>
          </div>
        </div>
      );
    case 'guest-privacy':
      return (
        <div className="hps hps--privacy">
          <div className="hps__privacy-shield">🛡️</div>
          <div className="hps__privacy-title">הכל נמחק</div>
          <div className="hps__privacy-desc">7 ימים אחרי האירוע</div>
          <div className="hps__privacy-items">
            <div className="hps__privacy-item"><span className="hps__privacy-check">✓</span>תמונות</div>
            <div className="hps__privacy-item"><span className="hps__privacy-check">✓</span>הודעות</div>
            <div className="hps__privacy-item"><span className="hps__privacy-check">✓</span>פרופילים</div>
            <div className="hps__privacy-item"><span className="hps__privacy-check">✓</span>מאצ׳ים</div>
          </div>
          <div className="hps__privacy-footer">בלי מעקב · בלי פרסומות · בלי עקבות</div>
        </div>
      );
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════ */

export default function HowItWorksPage() {
  const [journey, setJourney] = useState<Journey>('organizer');
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = journey === 'organizer' ? ORGANIZER_STEPS : GUEST_STEPS;
  const current = steps[step];

  const goTo = useCallback((idx: number) => {
    if (idx === step || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setStep(idx);
      setTransitioning(false);
    }, 250);
  }, [step, transitioning]);

  const next = useCallback(() => {
    if (step < steps.length - 1) goTo(step + 1);
  }, [step, steps.length, goTo]);

  const prev = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  /* Switch journey → reset to step 0 */
  const switchJourney = useCallback((j: Journey) => {
    if (j === journey) return;
    setTransitioning(true);
    setTimeout(() => {
      setJourney(j);
      setStep(0);
      setTransitioning(false);
    }, 250);
  }, [journey]);

  /* Keyboard nav */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') next();      // RTL: left = forward
      if (e.key === 'ArrowRight') prev();     // RTL: right = back
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  /* Auto-advance timer: progress bar fills over 6s then moves to next */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (step < steps.length - 1) {
        goTo(step + 1);
      }
    }, 6000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step, steps.length, goTo]);

  return (
    <SitePageLayout full className="hiw">
      <div className="hiw__content">

        {/* ═══ Hero ═══ */}
        <div className="hiw__hero">
          <h1 className="hiw__title">איך Eventa עובדת?</h1>
          <p className="hiw__subtitle">
            מהרגע שאתם מזמינים — ועד הרגע שהאורחים שלכם מוצאים את הלב.<br />
            צפו בחוויה דרך שני הצדדים.
          </p>
        </div>

        {/* ═══ Journey toggle ═══ */}
        <div className="hiw__toggle" role="tablist" aria-label="בחירת נקודת מבט">
          <button
            role="tab"
            aria-selected={journey === 'organizer'}
            className={`hiw__toggle-btn${journey === 'organizer' ? ' hiw__toggle-btn--active' : ''}`}
            onClick={() => switchJourney('organizer')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
            <span>העיניים של המארגן</span>
          </button>
          <button
            role="tab"
            aria-selected={journey === 'guest'}
            className={`hiw__toggle-btn${journey === 'guest' ? ' hiw__toggle-btn--active' : ''}`}
            onClick={() => switchJourney('guest')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
            <span>העיניים של האורח</span>
          </button>
        </div>

        {/* ═══ Story viewer ═══ */}
        <div className="hiw__story" role="tabpanel">

          {/* ── Progress bars (IG-style) ── */}
          <div className="hiw__progress" aria-label={`שלב ${step + 1} מתוך ${steps.length}`}>
            {steps.map((_, i) => (
              <div key={i} className="hiw__progress-track">
                <div
                  className={`hiw__progress-fill${i < step ? ' hiw__progress-fill--done' : i === step ? ' hiw__progress-fill--active' : ''}`}
                  style={i === step ? { animationDuration: '6s' } : undefined}
                />
              </div>
            ))}
          </div>

          {/* ── Main layout: text + phone ── */}
          <div className="hiw__stage">

            {/* Text side */}
            <div className={`hiw__text${transitioning ? ' hiw__text--out' : ''}`}>
              <div className="hiw__step-badge">{step + 1}</div>
              <h2 className="hiw__step-title">{current.title}</h2>
              <p className="hiw__step-desc">{current.desc}</p>
              <div className="hiw__step-counter">
                {step + 1} / {steps.length}
              </div>
            </div>

            {/* Phone side */}
            <div className="hiw__phone-wrap">
              <div className="hiw__phone">
                <div className="hiw__phone-notch" />
                <div className={`hiw__phone-screen${transitioning ? ' hiw__phone-screen--out' : ''}`}>
                  <PhoneScreen screen={current.screen} />
                </div>
              </div>
            </div>

          </div>

          {/* ── Navigation arrows ── */}
          <div className="hiw__nav">
            <button
              className="hiw__nav-btn"
              onClick={prev}
              disabled={step === 0}
              aria-label="הקודם"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button
              className="hiw__nav-btn"
              onClick={next}
              disabled={step === steps.length - 1}
              aria-label="הבא"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          </div>

          {/* ── Tap zones (click left/right of phone) ── */}
          <button className="hiw__tap hiw__tap--prev" onClick={prev} aria-label="הקודם" tabIndex={-1} />
          <button className="hiw__tap hiw__tap--next" onClick={next} aria-label="הבא" tabIndex={-1} />
        </div>

        {/* ═══ CTA ═══ */}
        <div className="hiw__cta">
          <h2 className="hiw__cta-title">מוכנים?</h2>
          <p className="hiw__cta-sub">
            הפעילו את Eventa באירוע שלכם ותנו לאורחים חוויה שהם יזכרו.
          </p>
          <a href="/dating/order" className="hiw__cta-btn">
            <span>להזמנה</span>
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
        </div>

      </div>
    </SitePageLayout>
  );
}
