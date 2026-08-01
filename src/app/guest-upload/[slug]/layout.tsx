import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `פורטל העלאת אורחים – ${slug} | Eventa`,
    description: 'העלו רשימת אורחים לאירוע שלכם בקלות דרך פורטל Eventa.',
  };
}

export default function GuestUploadLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
