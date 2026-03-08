import type { Metadata, Viewport } from 'next';
import { Rubik, Great_Vibes } from 'next/font/google';
import ErrorBoundary from '@/components/ErrorBoundary';
import './globals.css';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
  display: 'swap',
});

const greatVibes = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-script',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.eventa.productions'),
  title: {
    default: 'Eventa - Turn Any Event Into an Experience',
    template: '%s | Eventa',
  },
  description: 'Eventa מוסיפה שכבות חברתיות חכמות לאירועים - היכרויות, נטוורקינג, ומעורבות קהל.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Eventa',
  },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: 'https://www.eventa.productions',
    siteName: 'Eventa',
    title: 'Eventa - Turn Any Event Into an Experience',
    description: 'Eventa מוסיפה שכבות חברתיות חכמות לאירועים - היכרויות, נטוורקינג, ומעורבות קהל.',
    images: [{ url: '/og-image.png', width: 1536, height: 1024, alt: 'Eventa' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Eventa - Turn Any Event Into an Experience',
    description: 'Eventa מוסיפה שכבות חברתיות חכמות לאירועים.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
    <html lang="he" dir="rtl" className={`${rubik.variable} ${greatVibes.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
      </head>
      <body className={rubik.className}>
        <a href="#main-content" className="skip-to-content">דלג לתוכן</a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Eventa',
              url: 'https://www.eventa.productions',
              logo: 'https://www.eventa.productions/icons/icon-512x512.png',
              description: 'Eventa adds smart social layers to events - dating, networking, and audience engagement.',
              sameAs: [],
            }),
          }}
        />
        <ErrorBoundary>
          <main id="main-content">
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
