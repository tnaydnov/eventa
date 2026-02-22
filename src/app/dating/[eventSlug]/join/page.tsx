'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionStore } from '@/lib/store';
import { joinEvent } from '@/lib/api';
import { getDeviceIdentifiers } from '@/lib/device-fingerprint';
import { PageTransition } from '@/components/Animations';
import MobileGuard from '@/components/MobileGuard';

/** Detect in-app browsers / QR scanner WebViews that don't persist cookies */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // Social-media & messaging in-app browsers
  if (/FBAN|FBAV|Instagram|Snapchat|Line\/|Twitter|MicroMessenger|QQBrowser|BytedanceWebview|musical_ly|TikTok/i.test(ua)) return true;

  // iOS WebView — real Safari always includes "Safari/" in UA
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//i.test(ua)) return true;

  // Android WebView — the "; wv)" token is the official flag
  if (/Android/.test(ua) && /;\s*wv[);]/i.test(ua)) return true;

  // Samsung Internet's in-app mode / Samsung Browser custom tabs
  if (/SamsungBrowser\/.*CrossApp/i.test(ua)) return true;

  // Generic "standalone" detection — not maximally reliable but catches
  // many QR-scanner apps that open Chrome Custom Tabs without full browser UI
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__gCrWeb) return true; // iOS WKWebView injected object

  return false;
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const setParticipant = useSessionStore((s) => s.setParticipant);

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  // Check event status BEFORE showing terms — redirect if not active
  useEffect(() => {
    async function checkEventStatus() {
      try {
        const res = await fetch(`/api/auth/event-status?slug=${encodeURIComponent(eventSlug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== 'active' && data.status !== 'draft') {
            // Event is not active — redirect to marketing page
            const reason = data.status === 'ended' || data.status === 'archived' ? data.status : 'ended';
            router.replace(`/dating/event-over?reason=${reason}`);
            return;
          }
          if (data.status === 'not_found') {
            setError('האירוע לא נמצא — ודאו שהקישור תקין');
          }
        }
      } catch {
        // If status check fails, let them proceed normally
      }
      setStatusChecked(true);
    }
    checkEventStatus();
  }, [eventSlug, router]);

  // Detect in-app browser on mount
  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

  // Check for existing session
  useEffect(() => {
    const stored = localStorage.getItem('eventa_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.eventSlug === eventSlug) {
          setSession(session);
          // Check if profile is set up
          const hasProfile = localStorage.getItem(`profile_setup_${session.participantId}`);
          if (hasProfile) {
            router.replace(`/dating/${eventSlug}`);
          } else {
            router.replace(`/dating/${eventSlug}/setup`);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [eventSlug, router, setSession]);

  const handleJoin = async () => {
    const joinCode = searchParams.get('k');
    if (!joinCode) {
      setError('קוד כניסה חסר — סרקו שוב את ה-QR');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { localId, hardwareFingerprint } = await getDeviceIdentifiers();
      const result = await joinEvent(eventSlug, joinCode, localId, hardwareFingerprint);

      if (!result) {
        setError('קוד כניסה לא תקין או שהאירוע לא פעיל');
        setLoading(false);
        return;
      }

      const session = {
        eventId: result.eventId,
        eventSlug,
        eventName: result.eventName,
        backgroundImage: result.backgroundImage ?? null,
        participantId: result.participantId,
      };

      setSession(session);

      if (result.participant && result.participant.display_name) {
        setParticipant(result.participant);
        localStorage.setItem(`profile_setup_${result.participantId}`, 'true');
        router.replace(`/dating/${eventSlug}`);
      } else {
        router.replace(`/dating/${eventSlug}/setup`);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'DEVICE_BANNED') {
        setError('המכשיר הזה חסום מלהיכנס לאירוע זה');
      } else {
        setError('שגיאה בהתחברות — נסו שוב');
      }
    }

    setLoading(false);
  };

  return (
    <MobileGuard>
      <PageTransition>
        {!statusChecked ? (
          <div
            className="app-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100dvh',
            }}
          >
            <img src="/icons/Eventa_Logo.png" alt="Eventa" width={100} height={100} style={{ objectFit: 'contain', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ) : (
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
        <img src="/icons/Eventa_Logo.png" alt="Eventa" width={140} height={140} style={{ objectFit: 'contain' }} />

        {inAppBrowser && (
          <div
            style={{
              background: 'rgba(255, 180, 50, 0.12)',
              border: '1px solid rgba(255, 180, 50, 0.3)',
              borderRadius: '12px',
              padding: '14px 18px',
              maxWidth: '320px',
              width: '100%',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#ffb432',
            }}
          >
            <strong>⚠️ שימו לב</strong>
            <br />
            אתם גולשים מתוך אפליקציה חיצונית. כדי שהחיבור שלכם יישמר,
            פתחו את הקישור ב-
            <strong>Safari</strong> או <strong>Chrome</strong>.
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  const btn = document.getElementById('copy-link-btn');
                  if (btn) btn.textContent = '✅ הקישור הועתק!';
                } catch {
                  // Fallback: select a temporary input
                  const input = document.createElement('input');
                  input.value = window.location.href;
                  document.body.appendChild(input);
                  input.select();
                  document.execCommand('copy');
                  document.body.removeChild(input);
                  const btn = document.getElementById('copy-link-btn');
                  if (btn) btn.textContent = '✅ הקישור הועתק!';
                }
              }}
              id="copy-link-btn"
              style={{
                display: 'block',
                margin: '10px auto 0',
                padding: '8px 20px',
                background: 'rgba(255, 180, 50, 0.2)',
                border: '1px solid rgba(255, 180, 50, 0.4)',
                borderRadius: '8px',
                color: '#ffb432',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📋 העתק קישור
            </button>
          </div>
        )}

        <h1 style={{ fontSize: '28px', color: 'var(--primary)', margin: 0 }}>
          ברוכים הבאים!
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6 }}>
          האפליקציה מאפשרת לכם ליצור קשר עם רווקים ורווקות באירוע.
          <br />
          כל המידע נמחק אוטומטית לאחר 7 ימים.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            background: 'var(--surface)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '320px',
            cursor: 'pointer',
          }}
          onClick={() => setAgreed(!agreed)}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              border: `2px solid ${agreed ? 'var(--primary)' : 'var(--card-border)'}`,
              background: agreed ? 'var(--primary)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {agreed && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: '14px', textAlign: 'start' }}>
            אני מסכים/ה ל<a href="/terms" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>תנאי השימוש</a> ו<a href="/privacy" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>מדיניות הפרטיות</a>
          </span>
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p>
        )}

        <button
          className="btn btn-primary"
          style={{ maxWidth: '320px' }}
          disabled={!agreed || loading}
          onClick={handleJoin}
        >
          {loading ? 'מתחבר...' : 'המשך'}
        </button>
      </div>
        )}
      </PageTransition>
    </MobileGuard>
  );
}
