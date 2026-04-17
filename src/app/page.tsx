import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import ComingSoonSection from '@/components/ComingSoonSection';
import { Reveal, HeroReveal } from '@/components/HomeReveal';

export const metadata: Metadata = {
  title: 'Eventa - הפכו כל אירוע לחוויה',
  description:
    'Eventa מוסיפה שכבת חוויה חכמה לכל אירוע - חיבורים, אינטראקציות ורגעים שנשארים. הכל בדפדפן, בלי להוריד כלום.',
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
            Eventa מוסיפה שכבת חוויה חכמה לכל אירוע - חיבורים, אינטראקציות ורגעים שנשארים.
            <br />
            הכל ישר מהדפדפן, בלי להוריד כלום.
          </p>
        </HeroReveal>
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
                <span>🔥 זמין עכשיו</span>
              </div>
              <h2 className="hp__card-title">Eventa Dating</h2>
              <p className="hp__card-desc">
                שכבת היכרויות חכמה לאירועים.
                האורחים סורקים QR, יוצרים פרופיל ומתחילים להתחבר בזמן אמת.
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
            זו רק ההתחלה
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

        {/* Social links */}
        <div className="hp__footer-social">
          <a
            href="https://wa.me/972507165658"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="hp__social-link"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
          <a
            href="https://www.instagram.com/eventa.productions"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hp__social-link"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a
            href="https://www.facebook.com/share/1AvY7s8cge/?mibextid=wwXIfr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="hp__social-link"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
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

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/972507165658"
        target="_blank"
        rel="noopener noreferrer"
        className="hp__fab-wa"
        aria-label="שלחו לנו הודעה בWhatsApp"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </main>
  );
}
