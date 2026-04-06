import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import ComingSoonSection from '@/components/ComingSoonSection';
import { Reveal, HeroReveal } from '@/components/HomeReveal';

export const metadata: Metadata = {
  title: 'Eventa - הפכו כל אירוע לחוויה',
  description:
    'Eventa מוסיפה שכבות חכמות לאירועים - היכרויות, נטוורקינג ועוד. הכל בדפדפן, בלי להוריד כלום.',
  alternates: { canonical: 'https://www.eventa.productions' },
};

export default function HomePage() {
  return (
    <main id="main-content" className="hp" dir="rtl">
      {/* ── Cinematic background ── */}
      <div className="hp__cinema" aria-hidden="true">
        <div className="hp__orb hp__orb--1" />
        <div className="hp__orb hp__orb--2" />
        <div className="hp__orb hp__orb--3" />
      </div>

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

      {/* ── Hero - full viewport ── */}
      <header className="hp__hero">
        <HeroReveal className="hp__hero-inner">
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
        </HeroReveal>
        <div className="hp__scroll-cue" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </header>

      {/* ── Services - wide layout ── */}
      <section className="hp__services">
        <Reveal>
          <p className="hp__services-label">השירותים שלנו</p>
        </Reveal>

        {/* Dating - large split-layout card */}
        <Reveal delay={0.1}>
          <Link href="/dating" className="hp__card hp__card--live">
            <div className="hp__card-body">
              <div className="hp__card-status">
                <span className="hp__card-dot" />
                <span>זמין עכשיו</span>
              </div>
              <h2 className="hp__card-title">Eventa Dating</h2>
              <p className="hp__card-desc">
                שכבת היכרויות חכמה לכל אירוע. האורחים סורקים QR, בונים פרופיל, ומגלים אחד את השנייה עם לייקים, מאצ׳ים וצ׳אט - בזמן אמת.
              </p>
              <div className="hp__card-features">
                <span className="hp__feature-pill">לייקים בזמן אמת</span>
                <span className="hp__feature-pill">מאצ׳ים חכמים</span>
                <span className="hp__feature-pill">צ׳אט מובנה</span>
                <span className="hp__feature-pill">ללא הורדה</span>
              </div>
              <span className="hp__card-cta">
                <span>גלו עוד</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </span>
            </div>
            <div className="hp__card-visual">
              <div className="hp__card-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            </div>
          </Link>
        </Reveal>

        {/* Coming soon services */}
        <Reveal delay={0.2}>
          <ComingSoonSection />
        </Reveal>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="hp__bottom-cta">
        <Reveal>
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
          © {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </main>
  );
}
