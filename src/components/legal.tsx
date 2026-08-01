import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND_NAME, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_E164, absoluteUrl } from '@/config/site';

/* ── Reusable building-blocks for legal pages (privacy, terms, accessibility) ── */

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-9 last:mb-0">
      <h2 className="text-lg font-bold text-[var(--primary)] mb-3.5 pb-2 border-b border-[var(--primary)]/15">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalSubheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[0.9375rem] font-semibold text-[var(--primary)] mb-2 mt-4">
      {children}
    </h3>
  );
}

export function LegalText({ bold, children }: { bold?: boolean; children: ReactNode }) {
  return (
    <p className={`text-[#ccc] text-[0.9375rem] leading-[1.8] mb-2.5${bold ? ' font-semibold mt-3.5' : ''}`}>
      {children}
    </p>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="text-[#ccc] text-[0.9375rem] leading-[1.8] pr-5 list-disc [&>li]:mb-2">
      {children}
    </ul>
  );
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const isExternal = href.startsWith('mailto:') || href.startsWith('http');
  const cls = 'text-[var(--primary)] font-medium no-underline';

  if (isExternal) {
    return <a href={href} className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

/* ── Contact details ── */

/** Inline mailto link. Renders nothing when NEXT_PUBLIC_CONTACT_EMAIL is unset. */
export function ContactEmailLink() {
  if (!CONTACT_EMAIL) return null;
  return <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>;
}

/**
 * Email + phone contact block for legal pages. Each line is omitted when the
 * corresponding value is not configured, so an operator can publish with
 * e-mail only, phone only, or neither.
 */
export function LegalContactDetails({ as = 'text' }: { as?: 'text' | 'list' }) {
  const Row = as === 'list' ? 'li' : LegalText;
  const rows: ReactNode[] = [];

  if (CONTACT_EMAIL) {
    rows.push(
      <Row key="email">
        דוא&quot;ל: <ContactEmailLink />
      </Row>,
    );
  }
  if (CONTACT_PHONE_E164) {
    rows.push(
      <Row key="phone">
        טלפון: <LegalLink href={`tel:${CONTACT_PHONE_E164}`}>{CONTACT_PHONE_DISPLAY}</LegalLink>
      </Row>,
    );
  }
  if (rows.length === 0) return null;
  return as === 'list' ? <LegalList>{rows}</LegalList> : <>{rows}</>;
}

/* ── Metadata helper ── */
export function legalMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: `${title} | ${BRAND_NAME}`,
    description,
    alternates: { canonical: absoluteUrl(path) },
  };
}
