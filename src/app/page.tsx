import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eventa — Turn Any Event Into an Experience',
  description:
    'Eventa adds smart social layers to events — dating, networking, and engagement tools that make your events unforgettable.',
  alternates: { canonical: 'https://www.eventa.productions' },
};

const PRODUCTS = [
  {
    emoji: '💘',
    title: 'Eventa Dating',
    desc: 'שכבת היכרויות חכמה לכל אירוע — חתונות, מסיבות, אירועי חברה ועוד. האורחים סורקים QR, בונים פרופיל, ונהנים מלייקים, מאצ׳ים וצ׳אטים.',
    href: '/dating',
    cta: 'גלו עוד',
    color: '#d4a59a',
  },
];

export default function HomePage() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)',
        color: '#f0f0f0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Nav ─── */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <Image
          src="/icons/Eventa_Logo.png"
          alt="Eventa"
          width={120}
          height={40}
          style={{ objectFit: 'contain' }}
          priority
        />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            href="/dating"
            style={{
              color: '#d4a59a',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(212,165,154,0.3)',
              transition: 'all 0.2s',
            }}
          >
            Dating
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px 24px 60px',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            color: '#d4a59a',
            fontWeight: 500,
            letterSpacing: '0.5px',
            marginBottom: '24px',
            background: 'rgba(212,165,154,0.08)',
            padding: '6px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(212,165,154,0.15)',
          }}
        >
          ✨ הפלטפורמה לחוויות באירועים
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '20px',
            color: '#fff',
          }}
        >
          הפכו כל אירוע
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #d4a59a, #ff6b9d, #d4a59a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            לחוויה בלתי נשכחת
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: '#999',
            maxWidth: '600px',
            lineHeight: 1.7,
            marginBottom: '48px',
          }}
        >
          Eventa מוסיפה שכבות חברתיות חכמות לאירועים — היכרויות, נטוורקינג, ומעורבות קהל. הכל בדפדפן, בלי להוריד כלום.
        </p>

        {/* ─── Products Grid ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            width: '100%',
            maxWidth: '700px',
          }}
        >
          {PRODUCTS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              style={{
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(212,165,154,0.15)`,
                borderRadius: '20px',
                padding: '32px 28px',
                textAlign: 'center',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '48px' }}>{p.emoji}</span>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>{p.title}</h2>
              <p style={{ fontSize: '14px', color: '#999', lineHeight: 1.7, margin: 0 }}>{p.desc}</p>
              <span
                style={{
                  marginTop: '8px',
                  color: p.color,
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {p.cta}
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 4l-6 6 6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#555',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Link href="/how-it-works" style={{ color: '#777', textDecoration: 'none' }}>איך זה עובד</Link>
          <Link href="/faq" style={{ color: '#777', textDecoration: 'none' }}>שאלות נפוצות</Link>
          <Link href="/privacy" style={{ color: '#777', textDecoration: 'none' }}>מדיניות פרטיות</Link>
          <Link href="/terms" style={{ color: '#777', textDecoration: 'none' }}>תנאי שימוש</Link>
          <Link href="/cookies" style={{ color: '#777', textDecoration: 'none' }}>מדיניות עוגיות</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: 0 }}>
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
