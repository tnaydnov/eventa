import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import GuestUploadClient from './GuestUploadClient';

export default async function GuestUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ k?: string; token?: string }>;
}) {
  const { slug } = await params;
  const portalParams = searchParams ? await searchParams : {};
  const token = portalParams.k || portalParams.token;

  if (token) {
    redirect(`/portal/${token}`);
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <GuestUploadClient slug={slug} />
    </Suspense>
  );
}
