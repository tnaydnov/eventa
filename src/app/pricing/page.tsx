import type { Metadata, Route } from 'next';
import Link from 'next/link';
import SitePageLayout from '@/components/SitePageLayout';
import { BASE_PRICE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'מחירון | Eventa',
  description:
    'הפעילו את Eventa באירוע שלכם. מחיר אחד פשוט – ₪300 לאירוע, הכל כלול.',
  alternates: { canonical: 'https://www.eventa.productions/pricing' },
};

/* ─── Icon components ─── */
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pri__feat-svg" aria-hidden="true" focusable="false">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pri__feat-svg" aria-hidden="true" focusable="false">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pri__feat-svg" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pri__feat-svg" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pri__feat-svg" aria-hidden="true" focusable="false">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pri__feat-svg" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/* ─── Feature data ─── */
interface Feature {
  icon: React.ComponentType;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: HeartIcon, title: 'אפליקציית היכרויות', desc: 'התאמות חכמות בזמן אמת בין אורחי האירוע.' },
  { icon: ChatIcon, title: 'הודעות לאורחים', desc: 'שליחת לינק ישיר לכל האורחים בהודעה.' },
  { icon: QrIcon, title: 'פוסטר QR מעוצב', desc: 'עיצוב מותאם אישית עם קוד QR ייחודי לאירוע.' },
  { icon: ScreenIcon, title: 'רקע מותאם אישית', desc: 'בחרו רקע שמתאים לסגנון ולאווירה של האירוע.' },
  { icon: ShieldIcon, title: 'פרטיות מובטחת', desc: 'כל המידע נמחק אוטומטית 7 ימים לאחר האירוע.' },
  { icon: ClockIcon, title: 'הפעלה מהירה', desc: 'ללא הורדה. הכל עובד ישירות מהדפדפן תוך שניות.' },
];

const leftFeatures = FEATURES.slice(0, 3);
const rightFeatures = FEATURES.slice(3);

/* ─── Feature card component ─── */
function FeatureCard({ icon: Icon, title, desc }: Feature) {
  return (
    <div className="pri__feat">
      <div className="pri__feat-icon"><Icon /></div>
      <h3 className="pri__feat-title">{title}</h3>
      <p className="pri__feat-desc">{desc}</p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <SitePageLayout full className="pricing-page">
      <div className="pri">

        <h1 className="sr-only">מחירון Eventa</h1>

        {/* ambient glow behind the number */}
        <div className="pri__glow" aria-hidden="true" />

        {/* ── Feature grid surrounding the price ── */}
        <div className="pri__grid">

          {/* LEFT column — first 3 features */}
          <div className="pri__col pri__col--start">
            {leftFeatures.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>

          {/* CENTER — hero price */}
          <div className="pri__center">
            <div className="pri__price">
              <span className="pri__currency">₪</span>
              <span className="pri__number">{BASE_PRICE}</span>
            </div>
            <p className="pri__tagline">פתרון אחד. מחיר אחד.<br/>אירוע מושלם.</p>
          </div>

          {/* RIGHT column — last 3 features */}
          <div className="pri__col pri__col--end">
            {rightFeatures.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>

        </div>

        {/* ── Bottom section ── */}
        <p className="pri__sub">לאירוע · תשלום חד&#8209;פעמי · הכל כלול</p>

        {/* CTA */}
        <Link href={'/dating/order' as Route} className="pri__cta">
          רכשו את החבילה המלאה ב-{BASE_PRICE}₪ בלבד!
        </Link>

        <p className="pri__cancel">ביטול חינם עד 24 שעות לפני האירוע</p>

        {/* fine-print */}
        <p className="pri__fine">
          המחיר סופי · אין מנוי · אין תוספות ·
          ניתן לשלם גם ב&#8209;BIT · לפרטים נוספים ראו&nbsp;
          <Link href="/terms">תנאי שימוש</Link>
        </p>

      </div>
    </SitePageLayout>
  );
}
