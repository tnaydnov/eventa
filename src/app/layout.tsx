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
  title: 'Wedding Singles',
  description: 'מצאו את ההתאמה שלכם באירוע',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wedding Singles',
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
