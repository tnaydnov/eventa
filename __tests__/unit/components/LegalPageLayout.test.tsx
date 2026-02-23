import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/link and next/image
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

import SitePageLayout from '@/components/SitePageLayout';

describe('SitePageLayout', () => {
  it('U-CMP-08: renders title + children', () => {
    render(
      <SitePageLayout title="מדיניות פרטיות">
        <p>תוכן העמוד</p>
      </SitePageLayout>
    );
    expect(screen.getByRole('heading', { name: 'מדיניות פרטיות' })).toBeInTheDocument();
    expect(screen.getByText('תוכן העמוד')).toBeInTheDocument();
  });

  it('renders updatedAt when provided', () => {
    render(
      <SitePageLayout title="תנאי שימוש" updatedAt="1 בינואר 2026">
        <p>content</p>
      </SitePageLayout>
    );
    expect(screen.getByText(/עודכן לאחרונה: 1 בינואר 2026/)).toBeInTheDocument();
  });

  it('renders footer links', () => {
    render(
      <SitePageLayout title="Test">
        <p>x</p>
      </SitePageLayout>
    );
    expect(screen.getByText('תנאי שימוש')).toBeInTheDocument();
    expect(screen.getByText('מדיניות פרטיות')).toBeInTheDocument();
    expect(screen.getByText('שאלות נפוצות')).toBeInTheDocument();
  });

  it('renders logo link to dating page', () => {
    render(
      <SitePageLayout title="Test">
        <p>x</p>
      </SitePageLayout>
    );
    const logo = screen.getByAltText('Eventa');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/dating');
  });
  });
});
