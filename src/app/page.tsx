'use client';

import { useEffect, useState } from 'react';
import { useSessionStore } from '@/lib/store';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';
import { RingIcon, SparklesIcon } from '@/components/Icons';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <MobileGuard>
      <PageTransition>
        <div className="app-container">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100dvh',
              padding: '32px',
              textAlign: 'center',
              gap: '16px',
            }}
          >
            <RingIcon size={64} color="var(--primary)" />
            <h1 style={{ fontSize: '28px', color: 'var(--primary)' }}>
              Wedding Singles
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
              כדי להיכנס, סרקו את קוד ה-QR שקיבלתם באירוע
            </p>
            {session && (
              <p style={{ color: 'var(--success)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <SparklesIcon size={16} color="var(--success)" /> יש לכם סשן פעיל — עברו לאירוע
              </p>
            )}
          </div>
        </div>
      </PageTransition>
    </MobileGuard>
  );
}
