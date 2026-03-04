'use client';

import { Suspense, use, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import MobileGuard from '@/components/MobileGuard';
import { PageTransition } from '@/components/Animations';

/**
 * /dating/[eventSlug]/unavailable
 * Shown when an event is paused, archived, or deleted.
 * The user's session is already cleared before redirecting here.
 *
 * Query param ?reason=paused|archived|deleted|ended
 */

const REASON_CONTENT: Record<string, { emoji: string; title: string; description: string; note?: string }> = {
  paused: {
    emoji: '⏸️',
    title: 'האירוע מושהה',
    description: 'מנהל האירוע השהה את האירוע זמנית. נסו לחזור מאוחר יותר.',
    note: 'ייתכן שהאירוע יחזור לפעילות בקרוב.',
  },
  archived: {
    emoji: '📦',
    title: 'האירוע הסתיים',
    description: 'האירוע הסתיים ולא ניתן להשתמש בו יותר.',
  },
  deleted: {
    emoji: '🗑️',
    title: 'האירוע נמחק',
    description: 'האירוע הוסר מהמערכת ולא ניתן לגשת אליו יותר.',
  },
  ended: {
    emoji: '🎉',
    title: 'האירוע הסתיים',
    description: 'האירוע הסתיים ולא ניתן להשתמש בו יותר.',
  },
};

const DEFAULT_CONTENT = {
  emoji: '🚫',
  title: 'האירוע לא זמין',
  description: 'לא ניתן לגשת לאירוע זה כרגע.',
};

export default function UnavailablePage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  return (
    <Suspense fallback={<div className="app-container" />}>
      <UnavailableContent params={params} />
    </Suspense>
  );
}

function UnavailableContent({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  use(params);
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? '';
  const content = useMemo(() => REASON_CONTENT[reason] ?? DEFAULT_CONTENT, [reason]);

  const isPaused = reason === 'paused';

  return (
    <MobileGuard>
      <PageTransition>
        <div
          className="app-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100dvh',
            padding: '32px',
            textAlign: 'center',
            gap: '24px',
          }}
        >
          <div style={{ fontSize: '64px' }}>{content.emoji}</div>

          <h1
            style={{
              fontSize: '24px',
              color: isPaused ? 'var(--accent)' : '#ff4d4d',
              margin: 0,
            }}
          >
            {content.title}
          </h1>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '16px',
              lineHeight: 1.6,
              maxWidth: '320px',
            }}
          >
            {content.description}
          </p>

          {content.note && (
            <div
              style={{
                marginTop: '8px',
                padding: '16px 24px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              {content.note}
            </div>
          )}
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
