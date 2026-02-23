import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import TermsContent from './TermsContent';

export const metadata: Metadata = {
  title: 'תנאי שימוש | Eventa',
  description: 'תנאי השימוש של Eventa - כללים, התחייבויות ומדיניות השירות.',
  alternates: { canonical: 'https://www.eventa.productions/terms' },
};

export default function TermsPage() {
  return (
    <SitePageLayout title="תנאי שימוש" updatedAt="פברואר 2026">
      <TermsContent />
    </SitePageLayout>
  );
}
