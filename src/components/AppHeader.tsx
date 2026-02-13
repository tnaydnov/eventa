'use client';

import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store';

export default function AppHeader() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);

  if (!session) return null;

  return (
    <header className="app-header">
      <h1>{session.eventName || 'Eventa'}</h1>
      <button
        onClick={() => router.push(`/dating/${session.eventSlug}/profile`)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
    </header>
  );
}
