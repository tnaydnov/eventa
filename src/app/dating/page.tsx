'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const DemoPhone = dynamic(() => import('./_components/DemoPhone'), { ssr: false });
const OrderForm = dynamic(() => import('./_components/OrderForm'), { ssr: false });

/* ── Smooth scroll helper ── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Feature data ── */
const FEATURES = [
  {
    icon: '📱',
    title: 'ישר מהדפדפן',
    desc: 'אפליקציית PWA שנפתחת ישר מהדפדפן — האורחים סורקים QR, נרשמים תוך דקה, ומתחילים. בלי חנות אפליקציות, בלי הורדה.',
  },
  {
    icon: '💘',
    title: 'גריד, סוויפ ומאצ׳',
    desc: 'גריד תמונות או סוויפ בסגנון טינדר — שני מצבי גלילה לבחירה. שליחת לייקים, ובמקרה של לייק הדדי — נוצר מאצ׳ ונפתח צ׳אט.',
  },
  {
    icon: '🧭',
    title: 'מצפן מפגש',
    desc: 'אחרי מאצ׳, שני הצדדים מפעילים מצפן שמכוון אותם אחד לכיוון השני בזמן אמת — בלי לחשוף מיקום מדויק.',
  },
  {
    icon: '💬',
    title: 'צ׳אט מיידי',
    desc: 'הודעות טקסט, תמונות והודעות קוליות בין מאצ׳ים — צ׳אט פרטי שנפתח ברגע שנוצר חיבור הדדי.',
  },
  {
    icon: '⏳',
    title: 'מוגבל לאירוע',
    desc: 'הכל קורה בזמן אמת, במהלך האירוע עצמו. אין פיד אינסופי, אין התמכרות — רק חלון הזדמנות קצר שיוצר ריגוש אמיתי.',
  },
  {
    icon: '🔒',
    title: 'פרטיות מלאה',
    desc: 'כל המידע האישי נמחק אוטומטית 7 ימים אחרי האירוע. ללא מעקב, ללא מודעות, ללא שיתוף עם צד שלישי.',
  },
];

const STEPS = [
  { num: '1', title: 'פונים אלינו', desc: 'שולחים את פרטי האירוע — סוג, תאריך וכמות אורחים. אנחנו חוזרים תוך 24 שעות עם הצעה מותאמת.' },
  { num: '2', title: 'מפיצים QR', desc: 'מקבלים QR ייחודי לאירוע ושמים אותו בהזמנות, על השולחנות, בסטורי — איפה שתרצו.' },
  { num: '3', title: 'האורחים סורקים', desc: 'סריקת QR, בניית פרופיל תוך דקה, ומיד אפשר לגלול בין הרווקים והרווקות באירוע.' },
  { num: '4', title: 'הקסם קורה', desc: 'לייקים, מאצ׳ים, שיחות ומפגשי מצפן — האורחים נהנים והחיבורים נוצרים מעצמם.' },
];

export default function LandingPage() {
  const revealRef = useRef<HTMLDivElement>(null);

  /* ── Scroll-reveal observer ── */
  useEffect(() => {
    const els = revealRef.current?.querySelectorAll('.reveal');
    if (!els?.length) return;

    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing" ref={revealRef}>
      {/* ═══ Nav ═══ */}
      <nav className="landing-nav">
        <div className="landing-nav__logo">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5" opacity="0.3"/>
            <path d="M20 8l-2 5-5 2 5 2 2 5 2-5 5-2-5-2-2-5z" fill="currentColor"/>
          </svg>
          Eventa
        </div>
        <div className="landing-nav__links">
          <button className="landing-nav__link" onClick={() => scrollTo('features')}>מה זה?</button>
          <button className="landing-nav__link" onClick={() => scrollTo('demo')}>דמו חי</button>
          <button className="landing-nav__link" onClick={() => scrollTo('how')}>איך זה עובד</button>
        </div>
        <button className="landing-nav__cta" onClick={() => scrollTo('order')}>הזמינו עכשיו</button>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="landing-hero">
        <div className="landing-hero__glow" />
        <div className="landing-hero__content">
          <span className="landing-badge">✨ הדור הבא של אירועים חברתיים</span>
          <h1 className="landing-heading">
            הפכו כל אירוע<br />
            ל<span className="gradient-text">חוויית היכרויות</span> בלתי נשכחת
          </h1>
          <p className="landing-hero__subheading">
            Eventa מוסיפה שכבת היכרויות חכמה לכל אירוע — חתונות, מסיבות, בר/בת מצוות, אירועי חברה ועוד. האורחים סורקים QR, בונים פרופיל, ומתחילים לגלות אחד את השנייה. הכל בדפדפן, בלי להוריד כלום.
          </p>
          <div className="landing-hero__actions">
            <button className="landing-btn landing-btn--primary" onClick={() => scrollTo('order')}>
              בואו נתחיל
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 4l-6 6 6 6" />
              </svg>
            </button>
            <button className="landing-btn landing-btn--ghost" onClick={() => scrollTo('demo')}>
              ראו דמו חי
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="6,3 17,10 6,17" fill="currentColor" opacity="0.5"/>
              </svg>
            </button>
          </div>

          <div className="landing-stats">
            <div className="landing-stat">
              <div className="landing-stat__num">0</div>
              <div className="landing-stat__label">התקנות נדרשות</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat__num">60 שנ׳</div>
              <div className="landing-stat__label">ליצירת פרופיל</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat__num">100%</div>
              <div className="landing-stat__label">פרטיות מובטחת</div>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-accent-line" />

      {/* ═══ Features ═══ */}
      <section id="features" className="landing-section landing-features reveal">
        <span className="landing-badge">🎯 למה Eventa?</span>
        <h2 className="landing-heading" style={{ fontSize: 'clamp(26px, 4vw, 42px)' }}>
          הכל מה שהאירוע שלכם <span className="gradient-text">צריך</span>
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          פלטפורמה שלמה שמנוהלת בשבילכם — מהרגע שפניתם ועד הלייק האחרון באירוע.
        </p>
        <div className="landing-features__grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <span className="feature-card__icon">{f.icon}</span>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-accent-line" />

      {/* ═══ Demo ═══ */}
      <section id="demo" className="landing-section landing-demo reveal">
        <span className="landing-badge">📱 ראו בעצמכם</span>
        <h2 className="landing-heading" style={{ fontSize: 'clamp(26px, 4vw, 42px)' }}>
          חווית השימוש — <span className="gradient-text">בדיוק ככה</span>
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          ככה זה נראה מעיני האורחים שלכם. לחצו על אחד הפרופילים!
        </p>
        <div className="landing-demo__wrapper">
          <div className="landing-demo__text">
            <h3>גריד וסוויפ</h3>
            <p>
              האורחים גוללים בין פרופילים בגריד מעוצב, או עוברים למצב סוויפ בסגנון טינדר. לחיצה על פרופיל חושפת תמונות, ביו ופרטים — עם אפשרות לשלוח לייק מיידי.
            </p>
            <h3>מאצ׳ים וצ׳אט</h3>
            <p>
              כשיש לייק הדדי — נוצר מאצ׳ עם אנימציה חגיגית, ונפתח צ׳אט פרטי. טקסט, תמונות והודעות קוליות — הכל בתוך האפליקציה.
            </p>
            <h3>מצפן מפגש</h3>
            <p>
              הפיצ׳ר הייחודי שלנו — מצפן שמכוון שני אנשים שעשו מאצ׳ אחד לכיוון השני בזמן אמת, בלי לחשוף את המיקום המדויק.
            </p>
          </div>
          <DemoPhone />
        </div>
      </section>

      <div className="landing-accent-line" />

      {/* ═══ How It Works ═══ */}
      <section id="how" className="landing-section landing-steps reveal">
        <span className="landing-badge">🚀 פשוט וקל</span>
        <h2 className="landing-heading" style={{ fontSize: 'clamp(26px, 4vw, 42px)' }}>
          איך זה <span className="gradient-text">עובד</span>?
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          ארבעה שלבים פשוטים — מפנייה ראשונה ועד חיבורים אמיתיים באירוע.
        </p>
        <div className="landing-steps__row">
          {STEPS.map(s => (
            <div key={s.num} className="step-card">
              <div className="step-card__num">{s.num}</div>
              <h3 className="step-card__title">{s.title}</h3>
              <p className="step-card__desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-accent-line" />

      {/* ═══ Order Form ═══ */}
      <section id="order" className="landing-section landing-order reveal">
        <span className="landing-badge">📋 בואו נתחיל</span>
        <h2 className="landing-heading" style={{ fontSize: 'clamp(26px, 4vw, 42px)' }}>
          הזמינו <span className="gradient-text">Eventa</span> לאירוע שלכם
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          מלאו את הפרטים ונחזור אליכם תוך 24 שעות עם הצעה מותאמת אישית.
        </p>
        <OrderForm />
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="landing-footer">
        <div className="landing-footer__brand">Eventa</div>
        <div className="landing-footer__links">
          <a href="/privacy">מדיניות פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
          <a href="/cookies">מדיניות עוגיות</a>
          <a href="/safety">טיפים לבטיחות</a>
          <a href="/community">כללי קהילה</a>
          <a href="/faq">שאלות נפוצות</a>
          <a href="/about">אודות</a>
        </div>
        <p className="landing-footer__copy">
          © {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}
