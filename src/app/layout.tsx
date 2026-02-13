import type { Metadata, Viewport } from 'next';
import { Rubik } from 'next/font/google';
import ErrorBoundary from '@/components/ErrorBoundary';
import './globals.css';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://eventa.productions'),
  title: {
    default: 'Eventa — Turn Any Event Into an Experience',
    template: '%s | Eventa',
  },
  description: 'Eventa מוסיפה שכבות חברתיות חכמות לאירועים — היכרויות, נטוורקינג, ומעורבות קהל.',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Eventa',
  },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: 'https://eventa.productions',
    siteName: 'Eventa',
    title: 'Eventa — Turn Any Event Into an Experience',
    description: 'Eventa מוסיפה שכבות חברתיות חכמות לאירועים — היכרויות, נטוורקינג, ומעורבות קהל.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Eventa — Turn Any Event Into an Experience',
    description: 'Eventa מוסיפה שכבות חברתיות חכמות לאירועים.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0A0A0A',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className={rubik.className}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
