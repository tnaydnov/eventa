import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/config/site';

export const metadata: Metadata = {
  title: 'איך זה עובד? | Eventa Dating',
  description:
    'שלוש דרכים להזמנת אפליקציית היכרויות לאירוע: תשלום מיידי, מילוי טופס ונחזור אליכם, או פנייה ישירה. סריקת QR, פרופיל ולייקים - הכל בדפדפן.',
  alternates: { canonical: absoluteUrl('/how-it-works') },
  openGraph: {
    title: 'איך זה עובד? | Eventa Dating',
    description:
      'שלוש דרכים להזמנת Eventa Dating לאירוע: תשלום מיידי, טופס פנייה, או יצירת קשר ישיר.',
    url: absoluteUrl('/how-it-works'),
    images: [{ url: '/og-image.png', width: 1536, height: 1024, alt: 'Eventa Dating - How It Works' }],
  },
};

export default function HowItWorksLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
