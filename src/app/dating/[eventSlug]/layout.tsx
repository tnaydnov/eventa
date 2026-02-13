'use client';

import { use, type ReactNode } from 'react';
import SessionProvider from '@/components/SessionProvider';
import CompassRequestListener from '@/components/CompassRequestListener';
import RealtimeNotificationListener from '@/components/RealtimeNotificationListener';
import PushSubscriptionManager from '@/components/PushSubscriptionManager';
import NetworkStatus from '@/components/NetworkStatus';
import EventBackground from '@/components/EventBackground';
import HeartbeatPinger from '@/components/HeartbeatPinger';
import MatchPopup from '@/components/MatchPopup';

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
      <CompassRequestListener />
      <RealtimeNotificationListener />
      <PushSubscriptionManager />
      <MatchPopup />
    </SessionProvider>
  );
}
