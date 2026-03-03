import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Shared wrapper for all non-landing pages:
 * legal (privacy, terms, cookies, safety, community, about),
 * info (FAQ, how-it-works), and pricing.
 *
 * Provides consistent header (logo + back button), footer, and colours
 * matching the /dating landing page.
 */
export default function SitePageLayout({
  children,
  title,
  updatedAt,
  wide = false,
  className,
}: {
  children: ReactNode;
  /** Page heading shown below the logo. Omit for pages with their own hero. */
  title?: string;
  updatedAt?: string;
  /** Use wider container (e.g. for pricing / how-it-works). Default: 640px. */
  wide?: boolean;
  /** Extra className on the outermost div (for page-specific selectors). */
  className?: string;
}) {
  return (
    <div dir="rtl" className={`site-page${className ? ` ${className}` : ''}`}>
      {/* Header */}
      <header className="site-page__header">
        <Link href="/dating" className="site-page__back" aria-label="חזרה">
          <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        <Link href="/dating" className="site-page__logo">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={100}
            height={34}
            style={{ objectFit: 'contain' }}
          />
        </Link>

        {title && (
          <h1 className="site-page__title">{title}</h1>
        )}
        {updatedAt && (
          <p className="site-page__updated">עודכן לאחרונה: {updatedAt}</p>
        )}
      </header>

      {/* Content */}
      <main className={`site-page__content${wide ? ' site-page__content--wide' : ''}`}>
        {children}
      </main>

      {/* Footer - matches /dating landing footer */}
      <footer className="site-page__footer">
        <div className="site-page__footer-brand">
          <Image
            src="/icons/Eventa_Logo.png"
            alt="Eventa"
            width={90}
            height={30}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div className="site-page__footer-links">
          <Link href="/how-it-works">איך זה עובד</Link>
          <Link href="/faq">שאלות נפוצות</Link>
          <Link href="/pricing">מחירון</Link>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/terms">תנאי שימוש</Link>
          <Link href="/cookies">מדיניות עוגיות</Link>
          <Link href="/accessibility">הצהרת נגישות</Link>
        </div>
        <p className="site-page__footer-copy">
          © {new Date().getFullYear()} Eventa. כל הזכויות שמורות.
        </p>
      </footer>
    </div>
  );
}
