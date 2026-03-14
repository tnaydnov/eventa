import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import { BASE_PRICE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'מחירון | Eventa',
  description:
    'הפעילו את Eventa באירוע שלכם. מחיר אחד, הכל כלול – אפליקציית היכרויות, הודעות WhatsApp לאורחים, ועוד.',
  alternates: { canonical: 'https://www.eventa.productions/pricing' },
};

/* ── All features included in the single price ── */
const FEATURES = [
  { icon: '💕', title: 'אפליקציית היכרויות מלאה', desc: 'סוויפ, לייקים, מאצ׳ים וצ׳אט' },
  { icon: '📲', title: 'הודעות WhatsApp לאורחים', desc: 'שליחה לפני האירוע – הצטרפות מהבית' },
  { icon: '🔐', title: 'כניסה מאובטחת', desc: 'אימות SMS — אין צורך בסיסמה' },
  { icon: '📋', title: 'רשימת אורחים מ-Excel', desc: 'העלאה מהירה של מספרי הטלפון' },
  { icon: '🖼️', title: 'פוסטר QR מעוצב', desc: 'מוכן להדפסה ולשיתוף דיגיטלי' },
  { icon: '🎨', title: 'רקע מותאם אישית', desc: 'התאימו את המראה לאירוע שלכם' },
  { icon: '🛡️', title: 'פרטיות מלאה', desc: 'מחיקה אוטומטית של כל המידע בתום האירוע' },
  { icon: '🔗', title: 'QR או קישור ישיר', desc: 'האורחים בוחרים איך להצטרף' },
];

/* ── Arrow icon for CTA ── */
function ArrowIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 4l-6 6 6 6" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <SitePageLayout wide className="pricing-page">
      {/* Ambient background glows */}
      <div className="pricing-glow" />

      <div className="pricing-content">
        {/* ═══ Hero ═══ */}
        <div className="pricing-hero">
          <p className="pricing-overline">מחיר אחד. הכל כלול.</p>
          <h1 className="pricing-title">
            <span className="pricing-title__accent">₪{BASE_PRICE}</span>
          </h1>
          <p className="pricing-per">תשלום חד-פעמי לאירוע</p>
          <p className="pricing-subtitle">
            כל מה שצריך כדי להפעיל שכבת היכרויות חכמה באירוע שלכם.
            <br />
            בלי תוספות, בלי הפתעות, בלי מנוי.
          </p>
        </div>

        {/* ═══ Orbit ring — visual separator ═══ */}
        <div className="pricing-orbit">
          <div className="pricing-orbit__ring" />
          <div className="pricing-orbit__dot pricing-orbit__dot--1" />
          <div className="pricing-orbit__dot pricing-orbit__dot--2" />
          <div className="pricing-orbit__dot pricing-orbit__dot--3" />
        </div>

        {/* ═══ Feature grid ═══ */}
        <div className="pricing-features">
          {FEATURES.map((f) => (
            <div className="pricing-feature" key={f.title}>
              <span className="pricing-feature__icon">{f.icon}</span>
              <h3 className="pricing-feature__title">{f.title}</h3>
              <p className="pricing-feature__desc">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ═══ CTA ═══ */}
        <div className="pricing-cta-section">
          <a href="/dating/order" className="pricing-cta">
            הפעילו את Eventa לאירוע
            <ArrowIcon />
          </a>
          <p className="pricing-reassurance">
            אין התחייבות · ניתן לבטל עד 24 שעות לפני האירוע
          </p>
        </div>

        {/* ═══ Promise strip ═══ */}
        <div className="pricing-promises">
          <div className="pricing-promise">
            <span className="pricing-promise__icon">✦</span>
            <span>אין עלויות נסתרות</span>
          </div>
          <div className="pricing-promise__sep" />
          <div className="pricing-promise">
            <span className="pricing-promise__icon">✦</span>
            <span>ביטול חינם עד 24 שעות לפני</span>
          </div>
          <div className="pricing-promise__sep" />
          <div className="pricing-promise">
            <span className="pricing-promise__icon">✦</span>
            <span>תשלום מאובטח</span>
          </div>
        </div>

        {/* ═══ Legal disclosure ═══ */}
        <div className="pricing-disclosure">
          <h2 className="pricing-disclosure__title">פרטי תשלום ומדיניות</h2>
          <ul className="pricing-disclosure__list">
            <li>
              <strong>מחיר:</strong> ₪{BASE_PRICE} — המחיר הסופי. אין חיוב במע&quot;מ (המפעיל אינו עוסק מורשה בשלב זה).
            </li>
            <li>
              <strong>הכל כלול:</strong> אפליקציית היכרויות, פוסטר QR, הודעות WhatsApp לאורחים, רקע מותאם אישית ומחיקה אוטומטית בתום האירוע.
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
