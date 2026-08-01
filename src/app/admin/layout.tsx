import type { Metadata, Viewport } from 'next';
import './admin.css';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Prevent iOS auto-zoom in the admin portal
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
