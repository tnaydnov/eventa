import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eventa - הפכו כל אירוע לחוויה',
  description:
    'Eventa מוסיפה שכבות חכמות לאירועים - היכרויות, נטוורקינג ועוד. הכל בדפדפן, בלי להוריד כלום.',
  alternates: { canonical: 'https://www.eventa.productions' },
};

export default function HomePage() {
  return (
    <main id="main-content" className="hp" dir="rtl">
      {/* ── Ambient layer ── */}
      <div className="hp__ambient" aria-hidden="true" />

      {/* ── Nav ── */}
      <nav className="hp__nav" aria-label="ניווט ראשי">
        <Image
          src="/icons/Eventa_Logo.png"
          alt="Eventa"
          width={160}
          height={54}
          style={{ objectFit: 'contain' }}
          quality={100}
          priority
        />
      </nav>

      {/* ── Hero ── */}
      <header className="hp__hero">
        <p className="hp__badge">הפלטפורמה לחוויות באירועים</p>
        <h1 className="hp__title">
          <span className="hp__title-line1">כל אירוע.</span>
          <span className="hp__title-line2">חוויה אחרת.</span>
        </h1>
        <p className="hp__sub">
          Eventa מוסיפה שכבות חכמות לכל אירוע - היכרויות, מעורבות קהל ועוד.
          <br />
          הכל ישר מהדפדפן, בלי להוריד כלום.
        </p>
      </header>

      {/* ── Services section ── */}
      <section className="hp__services">
        <p className="hp__services-label">השירותים שלנו</p>

        {/* Dating - LIVE */}
        <Link href="/dating" className="hp__card hp__card--live">
          <div className="hp__card-status">
            <span className="hp__card-dot" />
            <span>זמין עכשיו</span>
          </div>
          <div className="hp__card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h2 className="hp__card-title">Eventa Dating</h2>
          <p className="hp__card-desc">
            שכבת היכרויות חכמה לכל אירוע. האורחים סורקים QR, בונים פרופיל, ומגלים אחד את השנייה עם לייקים, מאצ׳ים וצ׳אט - בזמן אמת.
          </p>
          <span className="hp__card-cta">
            <span>גלו עוד</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </span>
        </Link>

        {/* Teaser - more coming */}
        <div className="hp__coming">
          <div className="hp__coming-header">
            <div className="hp__coming-line" />
            <span className="hp__coming-tag">ויש עוד בדרך...</span>
            <div className="hp__coming-line" />
          </div>

          {/* Rides - COMING SOON */}
          <div className="hp__card hp__card--soon" aria-disabled="true">
            <div className="hp__card-status hp__card-status--soon">
              <span>בקרוב</span>
            </div>
            <div className="hp__card-icon hp__card-icon--muted">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M5 17h2m10 0h2M2 9l2-6h16l2 6M2 9h20v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <h2 className="hp__card-title">Eventa Rides</h2>
            <p className="hp__card-desc">
              תיאום הסעות לאירוע. מציאת נהג תורן, שיתוף נסיעות ואירגון הגעה משותפת - כדי שכולם יגיעו בקלות.
            </p>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="hp__bottom-cta">
        <h2 className="hp__bottom-title">
          זה רק ההתחלה
        </h2>
        <p className="hp__bottom-sub">
          אנחנו עובדים על עוד שירותים שישנו את חוויית האירועים שלכם. בינתיים, גלו את Eventa Dating.
        </p>
        <Link href="/dating" className="hp__bottom-btn">
          <span>לEventa Dating</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="hp__footer">
        <div className="hp__footer-brand">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={120}
            height={40}
            style={{ objectFit: 'contain' }}
            quality={100}
          />
        </div>
        <nav className="hp__footer-links" aria-label="קישורים בתחתית">
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/terms">תנאי שימוש</Link>
          <Link href="/cookies">מדיניות עוגיות</Link>
          <Link href="/accessibility">הצהרת נגישות</Link>
        </nav>
        <p className="hp__footer-copy">
          © {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </main>
  );
}
