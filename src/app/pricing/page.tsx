import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import { BASE_PRICE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'מחירון | Eventa',
  description:
    'הפעילו את Eventa באירוע שלכם. מחיר אחד פשוט – ₪300 לאירוע, הכל כלול.',
  alternates: { canonical: 'https://www.eventa.productions/pricing' },
};

const INCLUDES = [
  'אפליקציית היכרויות לאירוע',
  'הודעות WhatsApp לאורחים',
  'פוסטר QR מעוצב',
  'רקע מותאם אישית',
  'מחיקת מידע בתום האירוע',
];

export default function PricingPage() {
  return (
    <SitePageLayout wide className="pricing-page">
      <div className="pri">

        {/* ambient glow behind the number */}
        <div className="pri__glow" aria-hidden="true" />

        {/* headline */}
        <p className="pri__headline">מחיר אחד. בלי הפתעות.</p>

        {/* hero price */}
        <div className="pri__price">
          <span className="pri__currency">₪</span>
          <span className="pri__number">{BASE_PRICE}</span>
        </div>

        <p className="pri__sub">לאירוע · תשלום חד&#8209;פעמי · הכל כלול</p>

        {/* includes – horizontal chips */}
        <div className="pri__chips">
          {INCLUDES.map((item) => (
            <span className="pri__chip" key={item}>{item}</span>
          ))}
        </div>

        {/* CTA */}
        <a href="/dating/order" className="pri__cta">הזמינו עכשיו</a>

        <p className="pri__cancel">ביטול חינם עד 24 שעות לפני האירוע</p>

        {/* fine-print */}
        <p className="pri__fine">
          המחיר סופי · אין מנוי · אין תוספות ·
          ניתן לשלם גם ב&#8209;BIT · לפרטים נוספים ראו&nbsp;
          <a href="/terms">תנאי שימוש</a>
        </p>

      </div>
    </SitePageLayout>
  );
}
