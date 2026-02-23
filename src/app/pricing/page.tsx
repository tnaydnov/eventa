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
  'פוסטר מעוצב עם QR (קובץ דיגיטלי, תוך 24 שעות)',
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

          {/* ── Messages add-on ── */}
          <div className="pricing-card pricing-card--addon">
            <div className="pricing-card__badge pricing-card__badge--addon">
              תוספת
            </div>
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
              ניתן להוסיף בזמן ההזמנה או מאוחר יותר
            </div>
          </div>
        </div>

        {/* Bottom total strip */}
        <div className="pricing-total">
          <div className="pricing-total__label">סה״כ עם הודעות</div>
          <div className="pricing-total__value">₪{BASE_PRICE + MSG_ADDON}</div>
        </div>

        {/* FAQ teaser */}
        <div className="pricing-faq-link">
          יש שאלות?{' '}
          <a href="/faq">עברו לשאלות נפוצות</a>
          {' '}או{' '}
          <a href="/dating#order">צרו איתנו קשר</a>
        </div>
      </div>
    </SitePageLayout>
  );
}
