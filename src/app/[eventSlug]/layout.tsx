'use client';

import { use, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import SessionProvider from '@/components/SessionProvider';
import NetworkStatus from '@/components/NetworkStatus';
import EventBackground from '@/components/EventBackground';
// Lazy-load heavy realtime + match popup components so they don't block the initial JS parse
const RealtimeNotificationListener = dynamic(
  () => import('@/components/RealtimeNotificationListener'),
  { ssr: false },
);
const MatchPopup = dynamic(() => import('@/components/MatchPopup'), { ssr: false });
const HeartbeatPinger = dynamic(() => import('@/components/HeartbeatPinger'), { ssr: false });

export default function EventLayout({
  params,
  children,
}: {
  params: Promise<{ eventSlug: string }>;
  children: ReactNode;
}) {
  const { eventSlug } = use(params);

  return (
    <SessionProvider eventSlug={eventSlug}>
      <EventBackground />
      <NetworkStatus />
      <HeartbeatPinger />
      <main id="main-content">
        {children}
      </main>
      <RealtimeNotificationListener />
      <MatchPopup />
    </SessionProvider>
  );
}
