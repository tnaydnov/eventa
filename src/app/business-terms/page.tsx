import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import BusinessTermsContent from './BusinessTermsContent';

export const metadata: Metadata = {
  title: 'תנאי הזמנה ללקוח | Eventa',
  description:
    'תנאי ההזמנה ללקוח של Eventa - מה כולל השירות, אחריות הצדדים, תלות בגורמים חיצוניים, ביטולים והחזרים.',
  alternates: { canonical: 'https://www.eventa.productions/business-terms' },
  // Draft, B2B-facing document - keep out of search index until reviewed.
  robots: { index: false, follow: false },
};

export default function BusinessTermsPage() {
  return (
    <SitePageLayout title="תנאי הזמנה ללקוח" updatedAt="יוני 2026">
      <BusinessTermsContent />
    </SitePageLayout>
  );
}
