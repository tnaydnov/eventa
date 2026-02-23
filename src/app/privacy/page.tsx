import type { Metadata } from 'next';
import SitePageLayout from '@/components/SitePageLayout';
import PrivacyContent from './PrivacyContent';

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | Eventa',
  description: 'מדיניות הפרטיות של Eventa - כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.',
  alternates: { canonical: 'https://www.eventa.productions/privacy' },
};

export default function PrivacyPage() {
  return (
    <SitePageLayout title="מדיניות פרטיות" updatedAt="פברואר 2026">
      <PrivacyContent />
    </SitePageLayout>
  );
}
