import { Suspense } from 'react';
import type { Metadata } from 'next';
import Wizard from '../_components/wizard/Wizard';

export const metadata: Metadata = {
  title: 'הזמנת Eventa Dating לאירוע | Eventa',
  description:
    'הזמינו את שירות ההיכרויות של Eventa לאירוע שלכם - חתונה, מסיבה, בר/בת מצווה ועוד. בחרו סוג אירוע, עיצוב פוסטר, רקע מותאם אישית ועוד.',
  alternates: { canonical: 'https://www.eventa.productions/dating/order' },
  robots: { index: true, follow: true },
};

export default function OrderPage() {
  return (
    <main id="main-content">
      <Suspense>
        <Wizard />
      </Suspense>
    </main>
  );
}
