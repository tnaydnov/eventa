import SitePageLayout from '@/components/SitePageLayout';
import { legalMetadata } from '@/components/legal';
import PrivacyContent from './PrivacyContent';

export const metadata = legalMetadata(
  'מדיניות פרטיות',
  'מדיניות הפרטיות של Eventa - כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.',
  '/privacy',
);

export default function PrivacyPage() {
  return (
    <SitePageLayout title="מדיניות פרטיות" updatedAt="פברואר 2026">
      <PrivacyContent />
    </SitePageLayout>
  );
}
