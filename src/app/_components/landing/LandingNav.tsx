'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  return (
    <nav className="landing-nav" aria-label="ניווט ראשי">
      <div className="landing-nav__logo">
        <Image
          src="/icons/Eventa_Logo.png"
          alt="Eventa"
          width={110}
          height={37}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>
      <div className="landing-nav__links">
        <a className="landing-nav__link" href="/how-it-works">איך זה עובד</a>
        <a className="landing-nav__link" href="/faq">שאלות נפוצות</a>
        <a className="landing-nav__link" href="/pricing">מחירון</a>
      </div>
      <a className="landing-nav__cta" href="/order">הזמינו עכשיו</a>

      {/* Mobile hamburger */}
      <button
        className={`landing-nav__burger${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(o => !o)}
        aria-label="תפריט"
        aria-expanded={menuOpen}
      >
        <span /><span /><span />
      </button>

      {menuOpen && (
        <div className="landing-nav__mobile-menu" role="dialog" aria-label="תפריט ניווט">
          <a href="/how-it-works" onClick={() => setMenuOpen(false)}>איך זה עובד</a>
          <a href="/faq" onClick={() => setMenuOpen(false)}>שאלות נפוצות</a>
          <a href="/pricing" onClick={() => setMenuOpen(false)}>מחירון</a>
          <a href="/order" className="landing-nav__mobile-cta" onClick={() => setMenuOpen(false)}>הזמינו עכשיו</a>
        </div>
      )}
    </nav>
  );
}
