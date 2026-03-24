import SitePageLayout from '@/components/SitePageLayout';
import { legalMetadata } from '@/components/legal';
import TermsContent from './TermsContent';

export const metadata = legalMetadata(
  'תנאי שימוש',
  'תנאי השימוש של Eventa - כללים, התחייבויות ומדיניות השירות.',
  '/terms',
);

export default function TermsPage() {
  return (
    <SitePageLayout title="תנאי שימוש" updatedAt="פברואר 2026">
      <TermsContent />
    </SitePageLayout>
  );
}
