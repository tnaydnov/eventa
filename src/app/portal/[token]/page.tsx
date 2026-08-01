'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import GuestUploadClient from '@/app/guest-upload/[slug]/GuestUploadClient';

function PortalInner() {
  const { token } = useParams<{ token: string }>();
  return <GuestUploadClient slug="" token={token} />;
}

export default function PortalPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PortalInner />
    </Suspense>
  );
}
