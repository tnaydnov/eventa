'use client';

import { useRouter } from 'next/navigation';
import { useSessionStore, useNotificationStore } from '@/lib/store';

export default function AppHeader() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const realtimeStale = useNotificationStore((s) => s.realtimeStale);

  if (!session) return null;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <h1 style={{ margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.eventName || 'Eventa'}</h1>
        {realtimeStale && (
          <span
            aria-live="polite"
            title="חיבור בזמן אמת איטי - מסנכרן..."
            style={{
              fontSize: '11px',
              color: '#b58900',
              background: 'rgba(181,137,0,0.15)',
              border: '1px solid rgba(181,137,0,0.3)',
              borderRadius: '8px',
              padding: '2px 6px',
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            מסנכרן...
          </span>
        )}
      </div>
      <button
        onClick={() => router.push(`/${session.eventSlug}/profile`)}
        aria-label="הפרופיל שלי"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '10px',
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
    </header>
  );
}
