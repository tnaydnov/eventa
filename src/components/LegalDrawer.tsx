'use client';

import { useEffect, useRef } from 'react';
import TermsContent from '@/app/terms/TermsContent';
import PrivacyContent from '@/app/privacy/PrivacyContent';
import CookiesContent from '@/app/cookies/CookiesContent';

const PAGES: Record<string, string> = {
  terms: 'תנאי שימוש',
  privacy: 'מדיניות פרטיות',
  cookies: 'מדיניות עוגיות',
};

const CONTENT: Record<string, React.FC> = {
  terms: TermsContent,
  privacy: PrivacyContent,
  cookies: CookiesContent,
};

/**
 * Full-screen slide-up overlay that renders legal page content
 * (terms / privacy / cookies) directly inside a scrollable drawer.
 * Used inside the event app so users can read and close without leaving.
 */
export default function LegalDrawer({
  page,
  onClose,
}: {
  page: 'terms' | 'privacy' | 'cookies' | null;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Lock body scroll while open */
  useEffect(() => {
    if (!page) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [page]);

  /* Close on Escape */
  useEffect(() => {
    if (!page) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [page, onClose]);

  if (!page) return null;

  const ContentComponent = CONTENT[page];

  return (
    <div
      ref={overlayRef}
      className="legal-drawer__overlay"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="legal-drawer">
        {/* Header bar */}
        <div className="legal-drawer__header">
          <span className="legal-drawer__title">{PAGES[page]}</span>
          <button
            className="legal-drawer__close"
            onClick={onClose}
            aria-label="סגירה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="legal-drawer__body" dir="rtl">
          <ContentComponent />
        </div>
      </div>
    </div>
  );
}
