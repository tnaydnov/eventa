import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import CookiesContent from './CookiesContent';

export const metadata: Metadata = {
  title: 'מדיניות עוגיות | Eventa',
  description: 'מדיניות העוגיות של Eventa - אילו עוגיות אנו משתמשים ולמה.',
  alternates: { canonical: 'https://www.eventa.productions/cookies' },
};

export default function CookiesPage() {
  return (
    <SitePageLayout title="מדיניות עוגיות" updatedAt="פברואר 2026">
      <CookiesContent />
    </SitePageLayout>
  );
}
