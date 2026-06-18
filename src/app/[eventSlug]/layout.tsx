import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { EventLayoutClient } from './EventLayoutClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EventLayout({
  params,
  children,
}: {
  params: Promise<{ eventSlug: string }>;
  children: ReactNode;
}) {
  return (
    <EventLayoutClient params={params}>
      {children}
    </EventLayoutClient>
  );
}
