import { Suspense } from 'react';
import type { Metadata } from 'next';
import Wizard from '../_components/wizard/Wizard';
import { absoluteUrl } from '@/config/site';

export const metadata: Metadata = {
  title: 'הזמנת Eventa לחתונה או לאירוע | Eventa',
  description:
    'הזמינו חוויית היכרויות עם QR, פוסטר וצ׳אט. מלאו כמה פרטים, בחרו עיצוב, וקבלו הכל מוכן להפצה.',
  alternates: { canonical: absoluteUrl('/order') },
  robots: { index: true, follow: true },
};

export default function OrderPage() {
  return (
    <main id="main-content" className="order-main">
      <div className="order-intro">
        <h1>הזמנת Eventa לחתונה או לאירוע</h1>
        <p>
          מלאו כמה פרטים קצרים על האירוע, בחרו את העיצוב שמתאים לכם, ואנחנו נכין עבורכם חוויית היכרויות עם QR, פרופילים, לייקים, מאצ׳ים וצ׳אט — בלי שהאורחים צריכים להוריד אפליקציה.
        </p>
      </div>
      <Suspense>
        <Wizard />
      </Suspense>
    </main>
  );
}
