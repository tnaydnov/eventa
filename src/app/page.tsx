import type { Metadata } from 'next';
import { BASE_PRICE } from '@/lib/config';
import { absoluteUrl } from '@/config/site';
import Image from 'next/image';
import LandingNav from './_components/landing/LandingNav';
import ScrollToButton from './_components/landing/ScrollToButton';
import RevealSections from './_components/landing/RevealSections';
import DemoPhone from './_components/demo/DemoPhone';
import OrderForm from './_components/OrderForm';
import { SocialLinks, WhatsAppFab } from '@/components/SocialLinks';
import { BRAND_NAME } from '@/config/site';

export const metadata: Metadata = {
  title: 'היכרויות בחתונה | אפליקציית QR לרווקים ורווקות | Eventa',
  description:
    'Eventa מוסיפה לחתונה שלכם חוויית היכרויות קלילה: האורחים סורקים QR, בונים פרופיל תוך דקה, עושים לייקים, מאצ׳ים וצ׳אט — בלי הורדה ובלי מבוכה.',
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: 'היכרויות בחתונה | אפליקציית QR לרווקים ורווקות | Eventa',
    description: 'חוויית היכרויות לחתונה: סריקת QR, מאצ׳ים וצ׳אט בזמן אמת — בלי הורדה ובלי מבוכה.',
    url: absoluteUrl('/'),
    images: [{ url: '/og-image.png', width: 1536, height: 1024, alt: 'Eventa Dating' }],
  },
};

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
            יש לכם רווקים ורווקות<br />
            <span className="gradient-text">בחתונה?</span>
          </h1>
          <p className="landing-hero__subheading">
            תנו להם דרך קלילה להכיר אחד את השנייה - בלי אפליקציה, בלי מבוכה. סורקים QR, בונים פרופיל תוך דקה, ומתחילים. הכל נמחק אחרי 7 ימים.
          </p>
          <div className="landing-hero__actions">
            <a className="landing-btn landing-btn--primary" href="/order">
              בדקו התאמה לחתונה שלכם
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                <path d="M7 4l-6 6 6 6" />
              </svg>
            </a>
            <ScrollToButton targetId="demo" />
          </div>

          <div className="landing-stats">
            <div className="landing-stat">
              <div className="landing-stat__num">0</div>
              <div className="landing-stat__label">התקנות</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat__num">60 שנ׳</div>
              <div className="landing-stat__label">לפרופיל</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat__num">7 ימים</div>
              <div className="landing-stat__label">ואז נמחק</div>
            </div>
          </div>
        </div>
      </section>

      <RevealSections>

      {/* ═══ Showcase - Cinematic Band ═══ */}
      <section className="landing-showcase reveal" aria-label="איך זה עובד באירוע">
        <div className="showcase__media">
          <Image
            src="/entrance_scanning.png"
            alt="אורחת סורקת QR בכניסה לחתונה עם Eventa"
            width={1920}
            height={1080}
            sizes="100vw"
            className="showcase__img"
            quality={100}
            priority={false}
          />
        </div>
        <div className="showcase__text">
          <div className="showcase__text-inner">
            <span className="landing-badge showcase__badge"><span aria-hidden="true">📍</span> ממש ככה זה נראה</span>
            <h2 className="showcase__heading">
              הרגע שבו אירוע<br />
              <span className="gradient-text">הופך להיכרות</span>
            </h2>
            <p className="showcase__desc">
              בכניסה לאירוע מחכה פוסטר מעוצב עם QR. סריקה אחת - וכל השאר קורה מעצמו, בזמן אמת.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Showcase feature strip (continuous) ═══ */}
      <section className="landing-section showcase-features reveal" aria-label="יתרונות">
        <div className="sf-grid">
          <div className="sf-item">
            <span className="sf-item__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" />
              </svg>
            </span>
            <h3 className="sf-item__title">סריקה חכמה בכניסה</h3>
            <p className="sf-item__desc">סורקים QR ונכנסים ישר מהדפדפן - בלי חנות אפליקציות ובלי הורדות.</p>
          </div>
          <div className="sf-item">
            <span className="sf-item__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <h3 className="sf-item__title">פרופיל תוך 60 שניות</h3>
            <p className="sf-item__desc">כמה פרטים ותמונה, ומתחילים לגלוש בין הרווקים והרווקות שבאירוע.</p>
          </div>
          <div className="sf-item">
            <span className="sf-item__icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </span>
            <h3 className="sf-item__title">מאצ׳ים וצ׳אט חי</h3>
            <p className="sf-item__desc">לייק הדדי פותח צ׳אט פרטי - כל הריגוש קורה במהלך האירוע עצמו.</p>
          </div>
        </div>
      </section>

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
          <a href="/order" className="order-split__cta">
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
        <div className="landing-footer__social">
          <SocialLinks linkClassName="landing-footer__social-link" />
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
          © {new Date().getFullYear()} {BRAND_NAME}. כל הזכויות שמורות.
        </p>
      </footer>

      {/* Floating WhatsApp button */}
      <WhatsAppFab className="landing-fab-wa" />
    </div>
  );
}
