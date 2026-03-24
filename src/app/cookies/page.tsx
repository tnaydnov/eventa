import SitePageLayout from '@/components/SitePageLayout';
import { legalMetadata } from '@/components/legal';
import CookiesContent from './CookiesContent';

export const metadata = legalMetadata(
  'מדיניות עוגיות',
  'מדיניות העוגיות של Eventa - אילו עוגיות אנו משתמשים ולמה.',
  '/cookies',
);

export default function CookiesPage() {
  return (
    <SitePageLayout title="מדיניות עוגיות" updatedAt="פברואר 2026">
      <CookiesContent />
    </SitePageLayout>
  );
}
