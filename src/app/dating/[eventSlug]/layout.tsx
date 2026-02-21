'use client';

import { use, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import SessionProvider from '@/components/SessionProvider';
import RealtimeNotificationListener from '@/components/RealtimeNotificationListener';
import NetworkStatus from '@/components/NetworkStatus';
import EventBackground from '@/components/EventBackground';
import HeartbeatPinger from '@/components/HeartbeatPinger';
const MatchPopup = dynamic(() => import('@/components/MatchPopup'), { ssr: false });

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
      {children}
      <RealtimeNotificationListener />
      <MatchPopup />
    </SessionProvider>
  );
}
