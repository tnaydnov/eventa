import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'איך זה עובד? | Eventa Dating',
  description:
    'תהליך פשוט בשלושה שלבים: סריקת QR באירוע, יצירת פרופיל תוך דקה, שליחת לייקים וצ׳אט עם מאצ׳ים - הכל בדפדפן בלי אפליקציה.',
  alternates: { canonical: 'https://www.eventa.productions/how-it-works' },
  openGraph: {
    title: 'איך זה עובד? | Eventa Dating',
    description:
      'שלושה שלבים פשוטים להיכרויות באירוע: סריקת QR, פרופיל ולייקים - הכל בדפדפן.',
    url: 'https://www.eventa.productions/how-it-works',
    images: [{ url: '/og-image.png', width: 1536, height: 1024, alt: 'Eventa Dating - How It Works' }],
  },
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
