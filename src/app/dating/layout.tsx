import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eventa Dating — הפכו כל אירוע לחוויית היכרויות',
  description:
    'Eventa Dating מוסיפה שכבת היכרויות חכמה לכל אירוע — חתונות, מסיבות, אירועי חברה ועוד. סריקת QR, פרופיל תוך דקה, לייקים, מאצ׳ים וצ׳אט.',
  openGraph: {
    title: 'Eventa Dating — הפכו כל אירוע לחוויית היכרויות',
    description:
      'שכבת היכרויות חכמה לכל אירוע. סריקת QR, מאצ׳ים, צ׳אט ומצפן מפגש — הכל בדפדפן.',
    url: 'https://eventa.productions/dating',
  },
};

export default function DatingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
