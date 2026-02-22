'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const DemoPhone = dynamic(() => import('./_components/DemoPhone'), { ssr: true });
const OrderForm = dynamic(() => import('./_components/OrderForm'), { ssr: true });

/* ── Smooth scroll helper ── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Feature data ── */
const FEATURES = [
  {
    icon: '📱',
    title: 'ישר מהדפדפן',
    desc: 'אפליקציית PWA שנפתחת ישר מהדפדפן - האורחים סורקים QR, נרשמים תוך דקה, ומתחילים. בלי חנות אפליקציות, בלי הורדה.',
  },
  {
    icon: '💘',
    title: 'גריד, סוויפ ומאצ׳',
    desc: 'גריד תמונות או סוויפ בסגנון טינדר - שני מצבי גלילה לבחירה. שליחת לייקים, ובמקרה של לייק הדדי - נוצר מאצ׳ ונפתח צ׳אט.',
  },
  {
    icon: '💬',
    title: 'צ׳אט מיידי',
    desc: 'הודעות טקסט ותמונות בין מאצ׳ים - צ׳אט פרטי שנפתח ברגע שנוצר חיבור הדדי.',
  },
  {
    icon: '⏳',
    title: 'מוגבל לאירוע',
    desc: 'הכל קורה בזמן אמת, במהלך האירוע עצמו. אין פיד אינסופי, אין התמכרות - רק חלון הזדמנות קצר שיוצר ריגוש אמיתי.',
  },
  {
    icon: '🔒',
    title: 'פרטיות מלאה',
    desc: 'כל המידע האישי נמחק אוטומטית 7 ימים אחרי האירוע. ללא מעקב, ללא מודעות, ללא שיתוף עם צד שלישי.',
  },
];

const STEPS = [
  { num: '1', title: 'פונים אלינו', desc: 'שולחים את פרטי האירוע - סוג, תאריך ופרטים שלכם. אנחנו חוזרים תוך 48 שעות עם הצעה מותאמת.' },
  { num: '2', title: 'מפיצים QR', desc: 'מקבלים QR ייחודי לאירוע ושמים אותו בכניסה, על הבר, בסטורי - איפה שתרצו.' },
  { num: '3', title: 'האורחים סורקים', desc: 'סריקת QR, בניית פרופיל תוך דקה, ומיד אפשר לגלול בין הרווקים והרווקות באירוע.' },
  { num: '4', title: 'הקסם קורה', desc: 'לייקים, מאצ׳ים ושיחות - האורחים נהנים והחיבורים נוצרים מעצמם.' },
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
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={110}
            height={37}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
        <div className="landing-nav__links">
          <button className="landing-nav__link" onClick={() => scrollTo('features')}>מה זה?</button>
          <button className="landing-nav__link" onClick={() => scrollTo('demo')}>דמו חי</button>
          <button className="landing-nav__link" onClick={() => scrollTo('how')}>איך זה עובד</button>
        </div>
        <a className="landing-nav__cta" href="/dating/order">הזמינו עכשיו</a>
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
            Eventa מוסיפה שכבת היכרויות חכמה לכל אירוע - חתונות, מסיבות, בר/בת מצוות, אירועי חברה ועוד. האורחים סורקים QR, בונים פרופיל, ומתחילים לגלות אחד את השנייה. הכל בדפדפן, בלי להוריד כלום.
          </p>
          <div className="landing-hero__actions">
            <a className="landing-btn landing-btn--primary" href="/dating/order">
              הזמינו עכשיו
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 4l-6 6 6 6" />
              </svg>
            </a>
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
          פלטפורמה שלמה שמנוהלת בשבילכם - מהרגע שפניתם ועד הלייק האחרון באירוע.
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
          חווית השימוש - <span className="gradient-text">בדיוק ככה</span>
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          ככה זה נראה מעיני האורחים שלכם. לחצו על אחד הפרופילים!
        </p>
        <div className="landing-demo__wrapper">
          <div className="landing-demo__text">
            <h3>גריד וסוויפ</h3>
            <p>
              האורחים גוללים בין פרופילים בגריד מעוצב, או עוברים למצב סוויפ בסגנון טינדר. לחיצה על פרופיל חושפת תמונות, ביו ופרטים - עם אפשרות לשלוח לייק מיידי.
            </p>
            <h3>מאצ׳ים וצ׳אט</h3>
            <p>
              כשיש לייק הדדי - נוצר מאצ׳ עם אנימציה חגיגית, ונפתח צ׳אט פרטי. טקסט ותמונות - הכל בתוך האפליקציה.
            </p>
          </div>
          <div className="demo-phone-wrapper">
            <DemoPhone />
            <div className="demo-try-hint">
              <span className="demo-try-hand">👆</span>
              <span>לחצו וגלו - זה אינטראקטיבי!</span>
            </div>
          </div>
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
          ארבעה שלבים פשוטים - מפנייה ראשונה ועד חיבורים אמיתיים באירוע.
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

      {/* ═══ Order / Contact ═══ */}
      <section id="order" className="landing-section landing-order reveal">
        <span className="landing-badge">📋 בואו נתחיל</span>
        <h2 className="landing-heading" style={{ fontSize: 'clamp(26px, 4vw, 42px)' }}>
          הזמינו <span className="gradient-text">Eventa</span> לאירוע שלכם
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          בחרו את הדרך שנוחה לכם — הזמנה מלאה עם בחירת עיצוב, או השארת פרטים ואנחנו נחזור אליכם.
        </p>

        <div className="order-split">
          {/* ── Order Now card ── */}
          <a href="/dating/order" className="order-split__cta">
            <div className="order-split__cta-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </div>
            <h3 className="order-split__cta-title">הזמנה מלאה</h3>
            <p className="order-split__cta-desc">
              בחרו סוג אירוע, עיצוב פוסטר, רקע מותאם אישית ועוד — ושלמו אונליין.
            </p>
            <span className="order-split__cta-btn">
              להזמנה &larr;
            </span>
          </a>

          {/* ── Or divider ── */}
          <div className="order-split__divider">
            <span>או</span>
          </div>

          {/* ── Contact form card ── */}
          <div className="order-split__form-wrap">
            <h3 className="order-split__form-title">רוצים לשמוע עוד?</h3>
            <p className="order-split__form-desc">
              השאירו פרטים ונחזור אליכם תוך 24 שעות עם הצעה מותאמת אישית.
            </p>
            <OrderForm />
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={90}
            height={30}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div className="landing-footer__links">
          <a href="/how-it-works">איך זה עובד</a>
          <a href="/faq">שאלות נפוצות</a>
          <a href="/privacy">מדיניות פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
          <a href="/cookies">מדיניות עוגיות</a>
        </div>
        <p className="landing-footer__copy">
          © {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}
