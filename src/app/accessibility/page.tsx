import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import AccessibilityContent from './AccessibilityContent';

export const metadata: Metadata = {
  title: 'הצהרת נגישות | Eventa',
  description: 'הצהרת הנגישות של Eventa - מידע על אמצעי הנגישות באתר בהתאם לתקן הישראלי 5568.',
  alternates: { canonical: 'https://www.eventa.productions/accessibility' },
};

export default function AccessibilityPage() {
  return (
    <SitePageLayout title="הצהרת נגישות" updatedAt="פברואר 2026">
      <AccessibilityContent />
    </SitePageLayout>
  );
}
