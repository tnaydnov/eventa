import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import ComingSoonSection from '@/components/ComingSoonSection';
import { Reveal, StatNumber, FeaturePill } from '@/components/HomeAnimations';

export const metadata: Metadata = {
  title: 'Eventa - הפכו כל אירוע לחוויה',
  description:
    'Eventa מוסיפה שכבות חכמות לאירועים - היכרויות, נטוורקינג ועוד. הכל בדפדפן, בלי להוריד כלום.',
  alternates: { canonical: 'https://www.eventa.productions' },
};

export default function HomePage() {
  return (
    <main id="main-content" className="hp" dir="rtl">
      {/* ── Ambient layer - multiple orbs ── */}
      <div className="hp__ambient" aria-hidden="true">
        <div className="hp__orb hp__orb--1" />
        <div className="hp__orb hp__orb--2" />
        <div className="hp__orb hp__orb--3" />
      </div>

      {/* ── Dot grid texture ── */}
      <div className="hp__grid-texture" aria-hidden="true" />

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
        <Reveal>
          <p className="hp__badge">
            <span className="hp__badge-dot" />
            הפלטפורמה לחוויות באירועים
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="hp__title">
            <span className="hp__title-line1">כל אירוע.</span>
            <span className="hp__title-line2">חוויה אחרת.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="hp__sub">
            Eventa מוסיפה שכבות חכמות לכל אירוע - היכרויות, מעורבות קהל ועוד.
            <br />
            הכל ישר מהדפדפן, בלי להוריד כלום.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="hp__hero-actions">
            <Link href="/dating" className="hp__hero-btn">
              התחילו עכשיו
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <Link href="/how-it-works" className="hp__hero-btn-ghost">
              איך זה עובד?
            </Link>
          </div>
        </Reveal>
        {/* Decorative rings */}
        <div className="hp__hero-rings" aria-hidden="true">
          <div className="hp__ring hp__ring--1" />
          <div className="hp__ring hp__ring--2" />
        </div>
      </header>

      {/* ── How it works - mini strip ── */}
      <section className="hp__steps">
        <Reveal>
          <p className="hp__steps-label">פשוט. מהיר. בלי אפליקציה.</p>
        </Reveal>
        <div className="hp__steps-grid">
          <Reveal delay={0.05} className="hp__step">
            <span className="hp__step-num">01</span>
            <span className="hp__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z" />
              </svg>
            </span>
            <span className="hp__step-title">סורקים QR</span>
            <span className="hp__step-desc">באירוע או מקישור</span>
          </Reveal>
          <div className="hp__step-arrow" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <Reveal delay={0.15} className="hp__step">
            <span className="hp__step-num">02</span>
            <span className="hp__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span className="hp__step-title">בונים פרופיל</span>
            <span className="hp__step-desc">30 שניות, בלי הורדה</span>
          </Reveal>
          <div className="hp__step-arrow" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <Reveal delay={0.25} className="hp__step">
            <span className="hp__step-num">03</span>
            <span className="hp__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M12 2l2.09 6.26L20.18 9l-5 4.27L16.82 20 12 16.77 7.18 20l1.64-6.73L3.82 9l6.09-.74L12 2z" />
              </svg>
            </span>
            <span className="hp__step-title">נהנים</span>
            <span className="hp__step-desc">לייקים, מאצ'ים, ברכות</span>
          </Reveal>
        </div>
      </section>

      {/* ── Services section ── */}
      <section className="hp__services">
        <Reveal>
          <p className="hp__services-label">השירותים שלנו</p>
        </Reveal>

        {/* Dating - LIVE - Showcase */}
        <Reveal>
          <Link href="/dating" className="hp__card hp__card--live hp__card--showcase">
            <div className="hp__card-shine" aria-hidden="true" />
            <div className="hp__card-status">
              <span className="hp__card-dot" />
              <span>זמין עכשיו</span>
            </div>
            <div className="hp__card-icon hp__card-icon--glow">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h2 className="hp__card-title">Eventa Dating</h2>
            <p className="hp__card-desc">
              שכבת היכרויות חכמה לכל אירוע. האורחים סורקים QR, בונים פרופיל, ומגלים אחד את השנייה עם לייקים, מאצ'ים וצ'אט - בזמן אמת.
            </p>
            <div className="hp__card-features">
              <FeaturePill>לייקים בזמן אמת</FeaturePill>
              <FeaturePill>מאצ'ים חכמים</FeaturePill>
              <FeaturePill>צ'אט מובנה</FeaturePill>
              <FeaturePill>ללא הורדה</FeaturePill>
            </div>
            <span className="hp__card-cta">
              <span>גלו עוד</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </span>
          </Link>
        </Reveal>

        {/* Teaser - more coming */}
        <ComingSoonSection />
      </section>

      {/* ── Stats strip ── */}
      <section className="hp__stats">
        <div className="hp__stats-glow" aria-hidden="true" />
        <StatNumber value="100" suffix="+" label="אירועים" />
        <div className="hp__stats-divider" />
        <StatNumber value="5,000" suffix="+" label="משתמשים" />
        <div className="hp__stats-divider" />
        <StatNumber value="1,200" suffix="+" label="מאצ'ים" />
      </section>

      {/* ── Bottom CTA ── */}
      <section className="hp__bottom-cta">
        <div className="hp__bottom-glow" aria-hidden="true" />
        <Reveal>
          <h2 className="hp__bottom-title">
            זה רק ההתחלה
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="hp__bottom-sub">
            אנחנו עובדים על עוד שירותים שישנו את חוויית האירועים שלכם. בינתיים, גלו את Eventa Dating.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <Link href="/dating" className="hp__bottom-btn">
            <span>לEventa Dating</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        </Reveal>
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
          &copy; {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </main>
  );
}
