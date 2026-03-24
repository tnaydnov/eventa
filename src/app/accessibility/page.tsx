import SitePageLayout from '@/components/SitePageLayout';
import { legalMetadata } from '@/components/legal';
import AccessibilityContent from './AccessibilityContent';

export const metadata = legalMetadata(
  'הצהרת נגישות',
  'הצהרת הנגישות של Eventa - מידע על אמצעי הנגישות באתר בהתאם לתקן הישראלי 5568.',
  '/accessibility',
);

export default function AccessibilityPage() {
  return (
    <SitePageLayout title="הצהרת נגישות" updatedAt="פברואר 2026">
      <AccessibilityContent />
    </SitePageLayout>
  );
}
