import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shared wrapper for legal pages (privacy, terms).
 * RTL, dark theme, constrained width, consistent spacing.
 * Styled with a subtle gradient header and professional typography.
 */
export default function LegalPageLayout({
  children,
  title,
  updatedAt,
}: {
  children: ReactNode;
  title: string;
  updatedAt: string;
}) {
  return (
    <div dir="rtl" style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #121212 0%, #0a0a0a 100%)',
      color: '#f0f0f0',
    }}>
      {/* Header */}
      <header style={{
        padding: '48px 24px 32px',
        textAlign: 'center',
        borderBottom: '1px solid rgba(212, 165, 154, 0.15)',
        background: 'linear-gradient(180deg, rgba(212, 165, 154, 0.08) 0%, transparent 100%)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '28px', marginBottom: '8px', display: 'block' }}>💒</span>
          <span style={{ color: 'var(--primary, #d4a59a)', fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px' }}>
            Wedding Singles
          </span>
        </Link>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#fff',
          margin: '16px 0 8px',
        }}>
          {title}
        </h1>
        <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
          עודכן לאחרונה: {updatedAt}
        </p>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '32px 24px 80px',
        lineHeight: 1.8,
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '24px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#666',
      }}>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '12px' }}>
          <Link href="/privacy" style={{ color: 'var(--primary, #d4a59a)', textDecoration: 'none' }}>מדיניות פרטיות</Link>
          <Link href="/terms" style={{ color: 'var(--primary, #d4a59a)', textDecoration: 'none' }}>תנאי שימוש</Link>
        </div>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} Wedding Singles. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
}
