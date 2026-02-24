import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';

export const metadata: Metadata = {
  title: 'מחירון | Eventa',
  description:
    'מחירון שירותי Eventa - חבילת אירוע בסיסית וסרוויסים נוספים. תמחור פשוט ושקוף.',
  alternates: { canonical: 'https://www.eventa.productions/pricing' },
};

/* ── Plan data ── */
const BASE_PRICE = 250;
const MSG_ADDON = 50;

const BASE_FEATURES = [
  'אפליקציית היכרויות מלאה לאירוע',
  'QR ייחודי + לינק הצטרפות',
  'גריד / סוויפ, לייקים, מאצ׳ים וצ׳אט',
  'פוסטר מעוצב עם QR (קובץ דיגיטלי, תוך 24 שעות מאישור התשלום)',
  'רקע מותאם אישית (אופציונלי)',
  'מחיקה אוטומטית של מידע אישי',
];

const MSG_FEATURES = [
  'שליחת הודעות WhatsApp לאורחים',
  'קישור אישי להצטרפות - ללא צורך ב-QR',
  'העלאת רשימת טלפונים מ-Excel',
];

export default function PricingPage() {
  return (
    <SitePageLayout wide className="pricing-page">
      {/* Background glow */}
      <div className="pricing-glow" />

      <div className="pricing-content">
        <h1 className="pricing-title">
          תמחור <span className="pricing-title__accent">פשוט ושקוף</span>
        </h1>
        <p className="pricing-subtitle">
          בלי הפתעות, בלי עלויות נסתרות. חבילה אחת שכוללת הכל - ותוספת אופציונלית למי
          שרוצה עוד.
        </p>

        {/* Cards row */}
        <div className="pricing-cards">

          {/* ── Base plan ── */}
          <div className="pricing-card pricing-card--base">
            <div className="pricing-card__badge">חבילת אירוע</div>
            <div className="pricing-card__price">
              <span className="pricing-card__currency">₪</span>
              <span className="pricing-card__amount">{BASE_PRICE}</span>
            </div>
            <p className="pricing-card__per">לאירוע</p>

            <ul className="pricing-card__features">
              {BASE_FEATURES.map((f) => (
                <li key={f}>
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    className="pricing-check"
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M6.5 10.5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <a href="/dating/order" className="pricing-card__cta">
              להזמנה
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
            </a>
          </div>

          {/* ── Messages add-on (coming soon) ── */}
          <div className="pricing-card pricing-card--addon pricing-card--coming-soon">
            <div className="pricing-card__badge pricing-card__badge--addon">
              תוספת
            </div>
            <span className="pricing-coming-soon-badge">בקרוב</span>
            <div className="pricing-card__price pricing-card__price--addon">
              <span className="pricing-card__plus">+</span>
              <span className="pricing-card__currency">₪</span>
              <span className="pricing-card__amount">{MSG_ADDON}</span>
            </div>
            <p className="pricing-card__per">הודעות לאורחים</p>

            <ul className="pricing-card__features">
              {MSG_FEATURES.map((f) => (
                <li key={f}>
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    className="pricing-check pricing-check--addon"
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M6.5 10.5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="pricing-card__note">
              שירות זה נמצא בפיתוח ויהיה זמין בקרוב
            </div>
          </div>
        </div>

        {/* Bottom total strip */}
        <div className="pricing-total">
          <div className="pricing-total__label">חבילת אירוע</div>
          <div className="pricing-total__value">₪{BASE_PRICE}</div>
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
              <strong>אופן התשלום:</strong> התשלום מתבצע לאחר יצירת קשר עם המפעיל, באמצעות BIT או PayBox. אין סליקה באתר.
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
