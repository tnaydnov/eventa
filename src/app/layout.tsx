import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Rubik, Great_Vibes } from 'next/font/google';
import ErrorBoundary from '@/components/ErrorBoundary';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_TAGLINE,
  GA_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  LOGO_SQUARE_URL,
  SITE_URL,
  SOCIAL_PROFILES,
} from '@/config/site';
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
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
    title: BRAND_NAME,
  },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: SITE_URL,
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1536, height: 1024, alt: BRAND_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
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
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const googleTagId = GOOGLE_ADS_ID || GA_MEASUREMENT_ID;

  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${greatVibes.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        {/* Google tag - only injected when an Ads/GA id is configured. */}
        {googleTagId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
              strategy="afterInteractive"
              id="google-tag-script"
            />
            <Script
              id="google-tag-config"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${[GOOGLE_ADS_ID, GA_MEASUREMENT_ID]
                .filter(Boolean)
                .map((id) => `gtag('config', '${id}');`)
                .join('\n              ')}
            `,
              }}
            />
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
              name: BRAND_NAME,
              url: SITE_URL,
              logo: LOGO_SQUARE_URL,
              description: BRAND_DESCRIPTION,
              ...(SOCIAL_PROFILES.length > 0 && { sameAs: SOCIAL_PROFILES }),
            }),
          }}
        />
        <ErrorBoundary>
            <WebVitalsReporter />
            {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
