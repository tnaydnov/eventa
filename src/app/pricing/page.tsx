import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import { BASE_PRICE, MSG_ADDON } from '@/lib/config';

export const metadata: Metadata = {
  title: 'מחירון | Eventa',
  description:
    'הפעילו את אפליקציית ההיכרויות של Eventa באירוע שלכם. חבילה אחת ברורה, תוספת אופציונלית.',
  alternates: { canonical: 'https://www.eventa.productions/pricing' },
};

/* ── Feature lists ── */

const BASE_FEATURES = [
  'אפליקציית היכרויות מלאה לאירוע',
  'כניסה לאפליקציה דרך QR או קישור',
  'כניסה מאובטחת עם קוד SMS',
  'סוויפ, לייקים, מאצ׳ים וצ׳אט',
  'פוסטר QR מוכן להדפסה',
  'רקע מותאם אישית (אופציונלי)',
  'מחיקה אוטומטית של מידע אישי בתום האירוע',
];

const MSG_FEATURES = [
  'הודעת WhatsApp לכל האורחים לפני האירוע',
  'הצטרפות לאפליקציה מהבית – בלי צורך לסרוק QR',
  'יותר רווקים ורווקות מצטרפים עוד לפני שהאירוע מתחיל',
  'העלאה מהירה של רשימת האורחים מקובץ Excel',
];

/* ── Check‑icon shared across cards ── */
function CheckIcon({ addon }: { addon?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`pricing-check${addon ? ' pricing-check--addon' : ''}`}
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 10.5l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Arrow icon for CTAs ── */
function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 4l-6 6 6 6" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <SitePageLayout wide className="pricing-page">
      {/* Background glow */}
      <div className="pricing-glow" />

      <div className="pricing-content">
        {/* ═══ Hero heading ═══ */}
        <h1 className="pricing-title">
          הפעילו את <span className="pricing-title__accent">Eventa</span> באירוע שלכם
        </h1>
        <p className="pricing-subtitle">
          בחרו את חבילת האירוע.
          <br />
          ניתן להוסיף שליחת הודעות לאורחים לפני האירוע (אופציונלי).
        </p>

        {/* ═══ Main product card ═══ */}
        <div className="pricing-card pricing-card--base">
          <div className="pricing-card__badge">חבילת Eventa לאירוע</div>
          <div className="pricing-card__price">
            <span className="pricing-card__amount">{BASE_PRICE}</span>
            <span className="pricing-card__currency">₪</span>
          </div>
          <p className="pricing-card__per">תשלום חד-פעמי לאירוע</p>

          <ul className="pricing-card__features">
            {BASE_FEATURES.map((f) => (
              <li key={f}>
                <CheckIcon />
                {f}
              </li>
            ))}
          </ul>

          <a href="/dating/order" className="pricing-card__cta">
            הפעילו את Eventa לאירוע
            <ArrowIcon />
          </a>
          <p className="pricing-card__reassurance">
            אין התחייבות · ניתן לבטל עד 24 שעות לפני האירוע
          </p>
        </div>

        {/* ═══ Addon upgrade card ═══ */}
        <div className="pricing-addon-section">
          <h2 className="pricing-addon-title">
            הגדילו פי 3 את מספר הרווקים והרווקות באפליקציה
          </h2>

          <div className="pricing-card pricing-card--addon">
            <div className="pricing-addon-tag">🔥 השדרוג שהכי מגדיל את מספר המשתתפים</div>

            <div className="pricing-card__price pricing-card__price--addon">
              <span className="pricing-card__plus">+</span>
              <span className="pricing-card__amount">{MSG_ADDON}</span>
              <span className="pricing-card__currency">₪</span>
            </div>

            <div className="pricing-addon-desc">
              <p>
                שליחת הודעת WhatsApp לכל האורחים לפני האירוע
                <br />
                עם קישור ישיר להצטרפות לאפליקציה.
              </p>
              <p>
                כך האורחים יכולים להצטרף בנוחות מהבית,
                <br />
                בזמן שלהם — בלי לחץ ובלי צורך לסרוק QR במהלך האירוע.
              </p>
            </div>

            <div className="pricing-addon-proof">
              אירועים ששולחים הודעה מראש מקבלים פי 3 יותר רווקים ורווקות באפליקציה
            </div>

            <ul className="pricing-card__features">
              {MSG_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon addon />
                  {f}
                </li>
              ))}
            </ul>

            <p className="pricing-addon-reinforcement">
              רוב הזוגות מוסיפים את השדרוג הזה כדי למקסם את מספר המשתתפים באפליקציה.
            </p>

            <a href="/dating/order" className="pricing-card__cta pricing-card__cta--addon">
              הוסיפו שליחת הודעות לאורחים
              <ArrowIcon />
            </a>
          </div>
        </div>

        {/* ═══ Summary strip ═══ */}
        <div className="pricing-total">
          <div className="pricing-total__label">סיכום הזמנה</div>
          <div className="pricing-total__breakdown">
            <span>חבילת Eventa לאירוע: <strong>₪{BASE_PRICE}</strong></span>
            <span className="pricing-total__optional">
              עם שליחת הודעות לאורחים: <strong>₪{BASE_PRICE + MSG_ADDON}</strong>
            </span>
          </div>
        </div>

        {/* FAQ teaser */}
        <div className="pricing-faq-link">
          יש שאלות?{' '}
          <a href="/faq">עברו לשאלות נפוצות</a>
          {' '}או{' '}
          <a href="/dating#order">צרו איתנו קשר</a>
        </div>

        {/* Legal disclosure */}
        <div className="pricing-disclosure">
          <h2 className="pricing-disclosure__title">פרטי תשלום ומדיניות</h2>
          <ul className="pricing-disclosure__list">
            <li>
              <strong>מחירים:</strong> המחירים המוצגים הם המחירים הסופיים. אין חיוב במע&quot;מ (המפעיל אינו עוסק מורשה בשלב זה).
            </li>
            <li>
              <strong>אין עלויות נוספות</strong> מעבר למחירים המוצגים בעמוד זה.
            </li>
            <li>
              <strong>מה כלול:</strong> תשלום חד-פעמי לאירוע הכולל אפליקציית היכרויות מותאמת, פוסטר דיגיטלי מעוצב עם QR, ומחיקה אוטומטית בתום האירוע.
            </li>
            <li>
              <strong>אופן התשלום:</strong> לאחר אישור ההזמנה, תקבלו מייל עם קישור לתשלום מאובטח. ניתן לשלם גם באמצעות BIT או PayBox.
            </li>
            <li>
              <strong>ביטולים:</strong> ניתן לבטל ללא חיוב עד 24 שעות לפני האירוע.
              לפרטים מלאים ראו <a href="/terms">תנאי שימוש</a> סעיף 20.
            </li>
          </ul>
        </div>
      </div>
    </SitePageLayout>
  );
}
