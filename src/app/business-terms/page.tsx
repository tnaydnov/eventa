import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import BusinessTermsContent from './BusinessTermsContent';

export const metadata: Metadata = {
  title: 'תנאי הזמנה ללקוחות משלמים | Eventa',
  description:
    'תנאי ההזמנה של Eventa ללקוחות משלמים — מה כולל השירות, אחריות הצדדים, תלות בגורמים חיצוניים, ביטולים, החזרים וקניין רוחני.',
  alternates: { canonical: 'https://www.eventa.productions/business-terms' },
  robots: { index: false, follow: false },
};

export default function BusinessTermsPage() {
  return (
    <SitePageLayout title="תנאי הזמנה ללקוחות משלמים" updatedAt="יוני 2026">
      <BusinessTermsContent />
    </SitePageLayout>
  );
}
