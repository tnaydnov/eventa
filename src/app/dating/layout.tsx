import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eventa Dating — הפכו כל אירוע לחוויית היכרויות',
  description:
    'Eventa Dating מוסיפה שכבת היכרויות חכמה לכל אירוע — חתונות, מסיבות, אירועי חברה ועוד. סריקת QR, פרופיל תוך דקה, לייקים, מאצ׳ים וצ׳אט.',
  alternates: { canonical: 'https://www.eventa.productions/dating' },
  openGraph: {
    title: 'Eventa Dating — הפכו כל אירוע לחוויית היכרויות',
    description:
      'שכבת היכרויות חכמה לכל אירוע. סריקת QR, מאצ׳ים וצ׳אט — הכל בדפדפן.',
    url: 'https://www.eventa.productions/dating',
    images: [{ url: '/og-image.png', width: 1536, height: 1024, alt: 'Eventa Dating' }],
  },
};

export default function DatingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
