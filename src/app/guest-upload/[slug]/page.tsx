import { Suspense } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import GuestUploadClient from './GuestUploadClient';

export default async function GuestUploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <GuestUploadClient slug={slug} />
    </Suspense>
  );
}
