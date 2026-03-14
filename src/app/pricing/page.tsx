import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import { BASE_PRICE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'מחירון | Eventa',
  description:
    'הפעילו את Eventa באירוע שלכם. מחיר אחד פשוט – ₪300 לאירוע, הכל כלול.',
  alternates: { canonical: 'https://www.eventa.productions/pricing' },
};

/* ── What's included — simple, client-friendly items ── */
const INCLUDES = [
  'אפליקציית היכרויות מוכנה לאירוע',
  'הודעות WhatsApp לאורחים לפני האירוע',
  'פוסטר QR מעוצב להדפסה',
  'רקע מותאם אישית לאירוע',
  'מחיקת כל המידע בתום האירוע',
];

export default function PricingPage() {
  return (
    <SitePageLayout wide className="pricing-page">
      <div className="pricing-content">

        {/* ═══ Price card ═══ */}
        <div className="pricing-card">
          <p className="pricing-label">מחיר אחד. בלי הפתעות.</p>

          <div className="pricing-amount">
            <span className="pricing-currency">₪</span>
            <span className="pricing-number">{BASE_PRICE}</span>
          </div>

          <p className="pricing-per">תשלום חד&#8209;פעמי לאירוע</p>

          {/* Divider */}
          <div className="pricing-divider" />

          {/* What's included */}
          <p className="pricing-includes-label">מה כלול:</p>
          <ul className="pricing-includes">
            {INCLUDES.map((item) => (
              <li key={item}>
                <svg className="pricing-check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M6 10.5l3 3 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a href="/dating/order" className="pricing-cta">
            הזמינו עכשיו
          </a>
          <p className="pricing-note">ביטול חינם עד 24 שעות לפני האירוע</p>
        </div>

        {/* ═══ Fine print ═══ */}
        <p className="pricing-fine-print">
          המחיר סופי · אין מנוי · אין תוספות ·
          ניתן לשלם גם ב&#8209;BIT · לפרטים נוספים ראו&nbsp;
          <a href="/terms">תנאי שימוש</a>
        </p>

      </div>
    </SitePageLayout>
  );
}
