'use client';

import { use } from 'react';
import MobileGuard from '@/components/MobileGuard';
import { PageTransition } from '@/components/Animations';

/**
 * /[eventSlug]/banned
 * Shown when a participant has been banned by an admin.
 * Their session is already cleared before redirecting here.
 */
export default function BannedPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  use(params);

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
          <div style={{ fontSize: '64px' }}><span aria-hidden="true">🚫</span></div>

          <h1 style={{ fontSize: '24px', color: '#ff4d4d', margin: 0 }}>
            הגישה שלך נחסמה
          </h1>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '16px',
              lineHeight: 1.6,
              maxWidth: '320px',
            }}
          >
            מנהל האירוע החליט לחסום את הגישה שלך.
            <br />
            אם אתה חושב שזו טעות, פנה למארגני האירוע.
          </p>

          <div
            style={{
              marginTop: '16px',
              padding: '16px 24px',
              borderRadius: '12px',
              background: 'rgba(255, 77, 77, 0.08)',
              border: '1px solid rgba(255, 77, 77, 0.2)',
              color: 'rgba(255, 77, 77, 0.8)',
              fontSize: '14px',
            }}
          >
            לא ניתן להירשם מחדש ממכשיר זה.
          </div>

          <a
            href="/"
            style={{
              marginTop: '8px',
              color: 'var(--primary, #d4a59a)',
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            חזרו לדף הראשי
          </a>
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
