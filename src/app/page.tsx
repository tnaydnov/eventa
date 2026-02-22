import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eventa — הפכו כל אירוע לחוויה',
  description:
    'Eventa מוסיפה שכבות חכמות לאירועים — היכרויות, נטוורקינג ועוד. הכל בדפדפן, בלי להוריד כלום.',
  alternates: { canonical: 'https://www.eventa.productions' },
};

export default function HomePage() {
  return (
    <div className="hp" dir="rtl">
      {/* ── Ambient layer ── */}
      <div className="hp__ambient" />

      {/* ── Nav ── */}
      <nav className="hp__nav">
        <Image
          src="/icons/Eventa_Logo.png"
          alt="Eventa"
          width={110}
          height={37}
          style={{ objectFit: 'contain' }}
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
          Eventa מוסיפה שכבות חכמות לכל אירוע — היכרויות, מעורבות קהל ועוד.
          <br />
          הכל ישר מהדפדפן, בלי להוריד כלום.
        </p>
      </header>

      {/* ── Services section ── */}
      <section className="hp__services">
        <p className="hp__services-label">השירותים שלנו</p>

        {/* Dating — LIVE */}
        <Link href="/dating" className="hp__card hp__card--live">
          <div className="hp__card-status">
            <span className="hp__card-dot" />
            <span>זמין עכשיו</span>
          </div>
          <div className="hp__card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h2 className="hp__card-title">Eventa Dating</h2>
          <p className="hp__card-desc">
            שכבת היכרויות חכמה לכל אירוע. האורחים סורקים QR, בונים פרופיל, ומגלים אחד את השנייה עם לייקים, מאצ׳ים וצ׳אט — בזמן אמת.
          </p>
          <span className="hp__card-cta">
            <span>גלו עוד</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </span>
        </Link>

        {/* Coming Soon cards — teaser grid */}
        <div className="hp__coming">
          <div className="hp__coming-header">
            <div className="hp__coming-line" />
            <span className="hp__coming-tag">בקרוב</span>
            <div className="hp__coming-line" />
          </div>

          <div className="hp__coming-grid">
            {/* Networking */}
            <div className="hp__card hp__card--soon">
              <div className="hp__card-icon hp__card-icon--muted">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="hp__card-title hp__card-title--sm">Eventa Network</h3>
              <p className="hp__card-desc hp__card-desc--sm">
                נטוורקינג חכם בכנסים ואירועי חברה. חיבור בין אנשים עם תחומי עניין משותפים.
              </p>
              <span className="hp__card-soon-badge">Coming Soon</span>
            </div>

            {/* Engage */}
            <div className="hp__card hp__card--soon">
              <div className="hp__card-icon hp__card-icon--muted">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <line x1="9" y1="10" x2="15" y2="10" />
                </svg>
              </div>
              <h3 className="hp__card-title hp__card-title--sm">Eventa Engage</h3>
              <p className="hp__card-desc hp__card-desc--sm">
                סקרים, Q&A חי, והצבעות בזמן אמת. דרך מעולה לשמור את האורחים מעורבים.
              </p>
              <span className="hp__card-soon-badge">Coming Soon</span>
            </div>

            {/* Mystery slot */}
            <div className="hp__card hp__card--mystery">
              <span className="hp__mystery-q">?</span>
              <p className="hp__card-desc hp__card-desc--sm">
                ויש עוד...<br />הישארו מעודכנים.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="hp__bottom-cta">
        <h2 className="hp__bottom-title">
          רוצים להיות הראשונים לדעת?
        </h2>
        <p className="hp__bottom-sub">
          יש לנו עוד הרבה בדרך. בינתיים, גלו את Eventa Dating ותנו לאורחים חוויה שלא ישכחו.
        </p>
        <Link href="/dating" className="hp__bottom-btn">
          <span>לEventa Dating</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="hp__footer">
        <div className="hp__footer-links">
          <Link href="/how-it-works">איך זה עובד</Link>
          <Link href="/faq">שאלות נפוצות</Link>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/terms">תנאי שימוש</Link>
          <Link href="/cookies">מדיניות עוגיות</Link>
        </div>
        <div className="hp__footer-copy">
          <span>© {new Date().getFullYear()}</span>
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={80}
            height={27}
            style={{ objectFit: 'contain' }}
          />
          <span>כל הזכויות שמורות.</span>
        </div>
      </footer>
    </div>
  );
}
