import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

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

/* ── Metadata helper ── */
export function legalMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: `${title} | Eventa`,
    description,
    alternates: { canonical: `https://www.eventa.productions${path}` },
  };
}
