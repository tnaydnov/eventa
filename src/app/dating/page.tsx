import { BASE_PRICE } from '@/lib/config';
import Image from 'next/image';
import LandingNav from './_components/landing/LandingNav';
import ScrollToButton from './_components/landing/ScrollToButton';
import RevealSections from './_components/landing/RevealSections';
import DemoPhone from './_components/demo/DemoPhone';
import OrderForm from './_components/OrderForm';

/* ── Feature data ── */
const FEATURES = [
  {
    icon: <span aria-hidden="true">📱</span>,
    title: 'ישר מהדפדפן',
    desc: 'אפליקציית PWA שנפתחת ישר מהדפדפן - האורחים סורקים QR, נרשמים תוך דקה, ומתחילים. בלי חנות אפליקציות, בלי הורדה.',
  },
  {
    icon: <span aria-hidden="true">💘</span>,
    title: 'גריד, סוויפ ומאצ׳',
    desc: 'גריד תמונות או סוויפ בסגנון טינדר - שני מצבי גלילה לבחירה. שליחת לייקים, ובמקרה של לייק הדדי - נוצר מאצ׳ ונפתח צ׳אט.',
  },
  {
    icon: <span aria-hidden="true">💬</span>,
    title: 'צ׳אט מיידי',
    desc: 'הודעות טקסט ותמונות בין מאצ׳ים - צ׳אט פרטי שנפתח ברגע שנוצר חיבור הדדי.',
  },
  {
    icon: <span aria-hidden="true">⏳</span>,
    title: 'מוגבל לאירוע',
    desc: 'הכל קורה בזמן אמת, במהלך האירוע עצמו. אין פיד אינסופי, אין התמכרות - רק חלון הזדמנות קצר שיוצר ריגוש אמיתי.',
  },
  {
    icon: <span aria-hidden="true">🔒</span>,
    title: 'פרטיות מלאה',
    desc: 'כל המידע האישי נמחק אוטומטית 7 ימים אחרי האירוע. ללא מעקב, ללא מודעות, ללא שיתוף עם צד שלישי.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      {/* ═══ Nav ═══ */}
      <LandingNav />

      <main id="main-content">
      {/* ═══ Hero ═══ */}
      <section className="landing-hero">
        <div className="landing-hero__glow" />
        <div className="landing-hero__content">
          <span className="landing-badge"><span aria-hidden="true">✨</span> הדור הבא של אירועים חברתיים</span>
          <h1 className="landing-heading">
            הפכו כל אירוע<br />
            ל<span className="gradient-text">חוויית היכרויות</span> בלתי נשכחת
          </h1>
          <p className="landing-hero__subheading">
            Eventa מוסיפה שכבת היכרויות חכמה לכל אירוע - חתונות, מסיבות, אירועי חברה ועוד. האורחים סורקים QR, בונים פרופיל, ומתחילים לדבר אחד עם השנייה. הכל בדפדפן, בלי להוריד כלום.
          </p>
          <div className="landing-hero__actions">
            <a className="landing-btn landing-btn--primary" href="/dating/order">
              הזמינו עכשיו
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                <path d="M7 4l-6 6 6 6" />
              </svg>
            </a>
            <ScrollToButton targetId="demo" />
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

      <RevealSections>
      <div className="landing-accent-line" />

      {/* ═══ Features ═══ */}
      <section id="features" className="landing-section landing-features reveal">
        <span className="landing-badge"><span aria-hidden="true">🎯</span> למה Eventa?</span>
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
        <span className="landing-badge"><span aria-hidden="true">📱</span> ראו בעצמכם</span>
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
              <span className="demo-try-hand" aria-hidden="true">👆</span>
              <span>לחצו וגלו - זה אינטראקטיבי!</span>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-accent-line" />

      {/* ═══ Quick Links ═══ */}
      <section className="landing-section landing-quicklinks reveal">
        <div className="quicklinks">
          <a href="/how-it-works" className="quicklink-card">
            <div className="quicklink-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="quicklink-card__title">איך זה עובד?</h3>
            <p className="quicklink-card__desc">4 שלבים פשוטים מהפנייה ועד האירוע</p>
            <span className="quicklink-card__arrow">&larr;</span>
          </a>

          <a href="/faq" className="quicklink-card">
            <div className="quicklink-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="13" x2="13" y2="13" />
              </svg>
            </div>
            <h3 className="quicklink-card__title">שאלות נפוצות</h3>
            <p className="quicklink-card__desc">תשובות לכל מה שצריך לדעת</p>
            <span className="quicklink-card__arrow">&larr;</span>
          </a>

          <a href="/pricing" className="quicklink-card">
            <div className="quicklink-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <h3 className="quicklink-card__title">מחירון</h3>
            <p className="quicklink-card__desc">מחיר אחד שכולל הכל - ₪{BASE_PRICE} לאירוע</p>
            <span className="quicklink-card__arrow">&larr;</span>
          </a>
        </div>
      </section>

      <div className="landing-accent-line" />

      {/* ═══ Order / Contact ═══ */}
      <section id="order" className="landing-section landing-order reveal">
        <span className="landing-badge"><span aria-hidden="true">📋</span> בואו נתחיל</span>
        <h2 className="landing-heading" style={{ fontSize: 'clamp(26px, 4vw, 42px)' }}>
          הזמינו <span className="gradient-text">Eventa</span> לאירוע שלכם
        </h2>
        <p className="landing-subheading" style={{ margin: '0 auto' }}>
          בחרו את הדרך שנוחה לכם - הזמנה מלאה עם בחירת עיצוב, או השארת פרטים ואנחנו נחזור אליכם.
        </p>

        <div className="order-split">
          {/* ── Order Now card ── */}
          <a href="/dating/order" className="order-split__cta">
            <div className="order-split__cta-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </div>
            <h3 className="order-split__cta-title">הזמנה מלאה</h3>
            <p className="order-split__cta-desc">
              בחרו סוג אירוע, עיצוב פוסטר, רקע מותאם אישית ועוד - ושלמו אונליין.
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
              השאירו פרטים ונחזור אליכם תוך 48 שעות עם הצעה מותאמת אישית.
            </p>
            <OrderForm />
          </div>
        </div>
      </section>
      </RevealSections>

      </main>

      {/* ═══ Footer ═══ */}
      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={120}
            height={40}
            style={{ objectFit: 'contain' }}
            quality={100}
          />
        </div>
        <nav className="landing-footer__links" aria-label="קישורים בתחתית">
          <a href="/how-it-works">איך זה עובד</a>
          <a href="/faq">שאלות נפוצות</a>
          <a href="/pricing">מחירון</a>
          <a href="/privacy">מדיניות פרטיות</a>
          <a href="/terms">תנאי שימוש</a>
          <a href="/cookies">מדיניות עוגיות</a>
          <a href="/accessibility">הצהרת נגישות</a>
        </nav>
        <p className="landing-footer__copy">
          © {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}
