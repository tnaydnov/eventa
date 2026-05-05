'use client';

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionStore } from '@/lib/store';
import { sendOtp, verifyOtp } from '@/lib/api';
import { getDeviceIdentifiers } from '@/lib/device-fingerprint';
import { OTP_RESEND_COOLDOWN_S } from '@/lib/config';
import MobileGuard from '@/components/MobileGuard';
import LegalDrawer from '@/components/LegalDrawer';
import PhoneInput from '@/components/PhoneInput';
import OtpInput from '@/components/OtpInput';
import OnboardingSlides from '@/components/OnboardingSlides';
import PremiumSplashScreen from '@/components/join/PremiumSplashScreen';
import PremiumJoinShell from '@/components/join/PremiumJoinShell';
import {
  SESSION_STORAGE_KEY,
  PROFILE_SETUP_KEY_PREFIX,
  ONBOARDING_SEEN_KEY_PREFIX,
} from '@/lib/constants';

/** Detect in-app browsers / QR scanner WebViews that don't persist cookies */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // Social-media & messaging in-app browsers
  if (/FBAN|FBAV|Instagram|Snapchat|Line\/|Twitter|MicroMessenger|QQBrowser|BytedanceWebview|musical_ly|TikTok/i.test(ua)) return true;

  // iOS WebView - real Safari always includes "Safari/" in UA
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//i.test(ua)) return true;

  // Android WebView - the "; wv)" token is the official flag
  if (/Android/.test(ua) && /;\s*wv[);]/i.test(ua)) return true;

  // Samsung Internet's in-app mode / Samsung Browser custom tabs
  if (/SamsungBrowser\/.*CrossApp/i.test(ua)) return true;

  // Generic "standalone" detection - not maximally reliable but catches
  // many QR-scanner apps that open Chrome Custom Tabs without full browser UI
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__gCrWeb) return true; // iOS WKWebView injected object

  return false;
}

/** Min local digits for a valid Israeli mobile number (e.g. "501234567") */
const VALID_LOCAL_DIGITS = 9;

/** Minimum time the splash stays visible when redirecting a returning user. */
const RETURNING_USER_MIN_SPLASH_MS = 600;

type JoinStep = 'welcome' | 'phone' | 'otp' | 'onboarding';
type Phase =
  | 'booting'
  | 'returning_user'
  | 'event_not_found'
  | 'event_inactive'
  | 'event_ended'
  | 'access_blocked'
  | 'fatal_error'
  | 'verifying_otp'
  | 'completing_join'
  | 'interactive';

interface ConsentRowProps {
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

/**
 * Premium consent row using a real native <input type="checkbox"> wrapped in a
 * <label>. Keeps full keyboard / screen-reader / autofill semantics.
 */
function ConsentRow({ checked, onToggle, ariaLabel, children }: ConsentRowProps) {
  return (
    <label className="pj-consent" data-checked={checked ? 'true' : 'false'}>
      <input
        type="checkbox"
        className="pj-consent-input"
        checked={checked}
        onChange={onToggle}
        aria-label={ariaLabel}
      />
      <span className="pj-consent-box" aria-hidden="true">
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" focusable="false">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="pj-consent-text">{children}</span>
    </label>
  );
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  return (
    <Suspense fallback={<PremiumSplashScreen subtitle="טוענים את חוויית האירוע..." />}>
      <JoinPageContent params={params} />
    </Suspense>
  );
}

function JoinPageContent({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const setParticipant = useSessionStore((s) => s.setParticipant);

  // ─── Phase machine + step ─────────────────────────────────
  const [phase, setPhase] = useState<Phase>('booting');
  const [step, setStep] = useState<JoinStep>('welcome');
  const [agreed, setAgreed] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'cookies' | null>(null);
  const [error, setError] = useState('');
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ─── Phone verification state ─────────────────────────────
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [otpValue, setOtpValue] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Onboarding navigation target ─────────────────────────
  const pendingNav = useRef<string | null>(null);

  // ─── Boot: combined session check + event status ──────────
  useEffect(() => {
    let cancelled = false;
    let returningTimer: ReturnType<typeof setTimeout> | null = null;

    async function boot() {
      // 1) Returning-user fast path
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session && session.eventSlug === eventSlug) {
            setSession(session);
            const dest = localStorage.getItem(`${PROFILE_SETUP_KEY_PREFIX}${session.participantId}`)
              ? `/dating/${eventSlug}`
              : `/dating/${eventSlug}/setup`;
            if (cancelled) return;
            setPhase('returning_user');
            returningTimer = setTimeout(() => {
              if (!cancelled) router.replace(dest);
            }, RETURNING_USER_MIN_SPLASH_MS);
            return;
          }
        } catch {
          // fall through to fresh boot
        }
      }

      // 2) Validate event status before showing the welcome card
      try {
        const res = await fetch(`/api/auth/event-status?slug=${encodeURIComponent(eventSlug)}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'not_found') {
          setPhase('event_not_found');
          return;
        }

        if (data.status === 'ended' || data.status === 'archived') {
          setPhase('event_ended');
          return;
        }

        if (
          data.status &&
          data.status !== 'active' &&
          data.status !== 'draft' &&
          data.status !== 'error'
        ) {
          // Unknown non-active state - treat as inactive
          setPhase('event_inactive');
          return;
        }
      } catch {
        // Network failure - allow user to proceed; later API calls will catch real issues
      }

      if (!cancelled) {
        setPhase('interactive');
        setStep('welcome');
      }
    }

    boot();
    return () => {
      cancelled = true;
      if (returningTimer) clearTimeout(returningTimer);
    };
  }, [eventSlug, router, setSession]);

  // Detect in-app browser on mount
  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

  // Cleanup resend timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  // ─── Helpers ──────────────────────────────────────────────

  const getJoinCode = useCallback((): string | null => {
    const code = searchParams.get('k');
    if (!code) {
      setError('קוד כניסה חסר - סרקו שוב את ה-QR');
      return null;
    }
    return code;
  }, [searchParams]);

  const completeJoin = useCallback(
    (result: {
      eventId: string;
      eventName: string;
      backgroundImage: string | null;
      participantId: string;
      participant: { display_name?: string | null } | null;
    }) => {
      const session = {
        eventId: result.eventId,
        eventSlug,
        eventName: result.eventName,
        backgroundImage: result.backgroundImage ?? null,
        participantId: result.participantId,
      };
      setSession(session);

      if (result.participant && result.participant.display_name) {
        // Returning user - skip onboarding
        setParticipant(result.participant as Parameters<typeof setParticipant>[0]);
        localStorage.setItem(`${PROFILE_SETUP_KEY_PREFIX}${result.participantId}`, 'true');
        setPhase('completing_join');
        router.replace(`/dating/${eventSlug}`);
      } else {
        // New user - onboarding gate, then setup
        const onboardingKey = `${ONBOARDING_SEEN_KEY_PREFIX}${result.participantId}`;
        if (localStorage.getItem(onboardingKey)) {
          setPhase('completing_join');
          router.replace(`/dating/${eventSlug}/setup`);
        } else {
          pendingNav.current = `/dating/${eventSlug}/setup`;
          setStep('onboarding');
          setPhase('interactive');
        }
      }
    },
    [eventSlug, router, setSession, setParticipant],
  );

  const handleOnboardingComplete = useCallback(() => {
    const session = useSessionStore.getState().session;
    if (session?.participantId) {
      localStorage.setItem(`${ONBOARDING_SEEN_KEY_PREFIX}${session.participantId}`, 'true');
    }
    const nav = pendingNav.current || `/dating/${eventSlug}/setup`;
    setPhase('completing_join');
    router.replace(nav);
  }, [eventSlug, router]);

  const startResendTimer = useCallback(() => {
    setResendTimer(OTP_RESEND_COOLDOWN_S);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────

  /** Welcome → Phone (phone verification is always required). */
  const handleTermsAccepted = useCallback(() => {
    if (!agreed) return;
    if (!getJoinCode()) return;
    setError('');
    setStep('phone');
  }, [agreed, getJoinCode]);

  const handleSendOtp = useCallback(async () => {
    const joinCode = getJoinCode();
    if (!joinCode) return;
    if (phone.length !== VALID_LOCAL_DIGITS) {
      setError('הזינו מספר סלולרי ישראלי תקין');
      return;
    }

    setPhase('verifying_otp');
    setError('');

    const fullPhone = `0${phone}`;
    const result = await sendOtp({ phone: fullPhone, eventSlug, joinCode });

    if (!result.success) {
      setError(result.error || 'שגיאה בשליחת הקוד - נסו שוב');
      setPhase('interactive');
      return;
    }

    setMaskedPhone(result.maskedPhone || '');
    setOtpValue('');
    setStep('otp');
    startResendTimer();
    setPhase('interactive');
  }, [phone, eventSlug, getJoinCode, startResendTimer]);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      const joinCode = getJoinCode();
      if (!joinCode) return;

      setPhase('verifying_otp');
      setError('');

      try {
        const { localId, hardwareFingerprint } = await getDeviceIdentifiers();
        const fullPhone = `0${phone}`;
        const result = await verifyOtp({
          phone: fullPhone,
          code,
          eventSlug,
          joinCode,
          fingerprint: localId,
          hardwareFingerprint,
          smsConsent,
        });
        completeJoin(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'DEVICE_BANNED') {
          setPhase('access_blocked');
          return;
        }
        setError(err instanceof Error ? err.message : 'אימות הקוד נכשל - נסו שוב');
        setPhase('interactive');
      }
    },
    [phone, eventSlug, smsConsent, getJoinCode, completeJoin],
  );

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;
    setOtpValue('');
    setError('');
    await handleSendOtp();
  }, [resendTimer, handleSendOtp]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────

  // Splash phases (boot, returning user, verifying, completing)
  if (phase === 'booting') {
    return (
      <MobileGuard>
        <PremiumSplashScreen subtitle="טוענים את חוויית האירוע..." />
      </MobileGuard>
    );
  }
  if (phase === 'returning_user') {
    return (
      <MobileGuard>
        <PremiumSplashScreen subtitle="מחזירים אותך לאירוע..." />
      </MobileGuard>
    );
  }
  if (phase === 'completing_join') {
    return (
      <MobileGuard>
        <PremiumSplashScreen subtitle="כבר נכנסים לאירוע..." />
      </MobileGuard>
    );
  }
  if (phase === 'event_not_found' || phase === 'event_inactive' || phase === 'event_ended' || phase === 'access_blocked' || phase === 'fatal_error') {
    const messages: Record<typeof phase, { title: string; body: React.ReactNode }> = {
      event_not_found: {
        title: 'האירוע לא נמצא',
        body: <>הקישור שקיבלתם לא מוביל לאירוע פעיל.<br />ודאו שהקישור תקין או פנו למארגן האירוע.</>,
      },
      event_inactive: {
        title: 'האירוע עדיין לא פעיל',
        body: <>האירוע הזה טרם התחיל.<br />נסו שוב סמוך למועד האירוע.</>,
      },
      event_ended: {
        title: 'האירוע הסתיים',
        body: <>תקופת ההיכרויות באירוע הזה הסתיימה.<br />תודה שהשתתפתם!</>,
      },
      access_blocked: {
        title: 'הגישה נחסמה',
        body: <>המכשיר הזה אינו יכול להיכנס לאירוע.<br />אם נראה לכם שזו טעות, פנו למארגן האירוע.</>,
      },
      fatal_error: {
        title: 'משהו השתבש',
        body: <>לא הצלחנו לטעון את האירוע כרגע.<br />נסו לרענן את הדף בעוד רגע.</>,
      },
    } as const;
    const m = messages[phase];
    return (
      <MobileGuard>
        <div className="pj-bg" dir="rtl">
          <div className="pj-shell-stage">
            <div className="pj-shell-header">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/Eventa_Logo.png" alt="Eventa" className="pj-shell-logo" width={76} height={76} draggable={false} decoding="async" />
              <h2 className="pj-shell-brand">Eventa</h2>
            </div>
            <div className="pj-card" role="alert">
              <h1 className="pj-title">{m.title}</h1>
              <p className="pj-subtitle">{m.body}</p>
            </div>
          </div>
        </div>
      </MobileGuard>
    );
  }

  // Onboarding (full-screen overlay component, keeps its own visuals)
  if (step === 'onboarding') {
    return (
      <MobileGuard>
        <OnboardingSlides onComplete={handleOnboardingComplete} />
      </MobileGuard>
    );
  }

  // Verifying OTP / sending OTP - keep splash for clear feedback
  if (phase === 'verifying_otp') {
    return (
      <MobileGuard>
        <PremiumSplashScreen
          subtitle={step === 'otp' ? 'מאמתים את הקוד...' : 'שולחים קוד אימות...'}
        />
      </MobileGuard>
    );
  }

  // ─── Interactive: welcome / phone / otp inside the premium shell ─

  const iabNotice = inAppBrowser ? (
    <div className="pj-iab" role="note">
      <div className="pj-iab-row">
        <div className="pj-iab-icon" aria-hidden="true">!</div>
        <div className="pj-iab-text">
          פתחתם את Eventa מתוך אפליקציה חיצונית. לחוויה יציבה יותר, מומלץ לפתוח ב-Safari או Chrome.
        </div>
      </div>
      <button type="button" className="pj-iab-btn" onClick={handleCopyLink}>
        <span role="status" aria-live="polite">
          {linkCopied ? 'הקישור הועתק' : 'העתקת קישור'}
        </span>
      </button>
      <p className="pj-iab-hint">
        {linkCopied
          ? 'פתחו Safari או Chrome והדביקו את הקישור שם.'
          : 'העתיקו את הקישור ופתחו אותו בדפדפן.'}
      </p>
    </div>
  ) : null;

  return (
    <MobileGuard>
      <PremiumJoinShell stepKey={step} notice={iabNotice}>
        {step === 'welcome' && (
          <>
            <h1 className="pj-title">ברוכים הבאים ל-Eventa</h1>
            <p className="pj-subtitle">
              הדרך הכי קלילה להכיר אנשים באירוע.
            </p>

            <div className="pj-badges" aria-hidden="false">
              <div className="pj-badge">
                <span className="pj-badge-icon" aria-hidden="true">⏱</span>
                נמחק אחרי 7 ימים
              </div>
              <div className="pj-badge">
                <span className="pj-badge-icon" aria-hidden="true">🔒</span>
                פרטי ומאובטח
              </div>
              <div className="pj-badge">
                <span className="pj-badge-icon" aria-hidden="true">📱</span>
                בלי הורדת אפליקציה
              </div>
            </div>

            <ConsentRow
              checked={agreed}
              onToggle={() => setAgreed(!agreed)}
              ariaLabel="אני מאשר/ת את תנאי השימוש, מדיניות הפרטיות ומדיניות העוגיות"
            >
              אני מאשר/ת את{' '}
              <button type="button" className="pj-link-btn" onClick={(e) => { e.stopPropagation(); setLegalPage('terms'); }}>תנאי השימוש</button>
              {' '}ו
              <button type="button" className="pj-link-btn" onClick={(e) => { e.stopPropagation(); setLegalPage('privacy'); }}>מדיניות הפרטיות</button>
              {' '}ו
              <button type="button" className="pj-link-btn" onClick={(e) => { e.stopPropagation(); setLegalPage('cookies'); }}>מדיניות העוגיות</button>
              , ומבין/ה כי באירועים מסוימים ייתכן ש-Eventa תצלם תכני אווירה ותיעוד של השימוש בשירות לצורכי שיווק ופרסום, כמפורט בתנאי השימוש.
            </ConsentRow>

            {error && <p className="pj-error" role="alert">{error}</p>}

            <button
              className="pj-cta"
              type="button"
              disabled={!agreed}
              onClick={handleTermsAccepted}
            >
              המשך
            </button>
          </>
        )}

        {step === 'phone' && (
          <>
            <h1 className="pj-title">אימות קצר ונכנסים</h1>
            <p className="pj-subtitle">
              נשלח קוד חד־פעמי כדי לוודא שהכניסה שייכת למשתתף/ת באירוע.
            </p>

            <PhoneInput
              value={phone}
              onChange={(v) => { setPhone(v); setError(''); }}
              disabled={false}
              error={undefined}
            />

            <ConsentRow
              checked={smsConsent}
              onToggle={() => setSmsConsent(!smsConsent)}
              ariaLabel="אני מאשר/ת קבלת קוד אימות ב-SMS"
            >
              אני מאשר/ת קבלת קוד אימות ב-SMS לצורך כניסה לשירות.
            </ConsentRow>

            {error && <p className="pj-error" role="alert">{error}</p>}

            <button
              className="pj-cta"
              type="button"
              disabled={phone.length !== VALID_LOCAL_DIGITS}
              onClick={handleSendOtp}
            >
              שלחו קוד
            </button>

            <button
              type="button"
              className="pj-link"
              onClick={() => { setStep('welcome'); setError(''); }}
            >
              חזרה
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1 className="pj-title">הזינו את הקוד</h1>
            <p className="pj-subtitle">
              {maskedPhone ? (
                <>שלחנו קוד למספר <span dir="ltr" style={{ unicodeBidi: 'embed' }}>{maskedPhone}</span></>
              ) : (
                'שלחנו קוד SMS לנייד שלכם'
              )}
            </p>

            <OtpInput
              value={otpValue}
              onChange={setOtpValue}
              onComplete={handleVerifyOtp}
              disabled={false}
              error={error || undefined}
            />

            {error && <p className="pj-error" role="alert">{error}</p>}

            <button
              type="button"
              className={`pj-link${resendTimer > 0 ? '' : ' is-primary'}`}
              disabled={resendTimer > 0}
              onClick={handleResendOtp}
            >
              {resendTimer > 0 ? `שלחו שוב (${resendTimer}s)` : 'שלחו שוב'}
            </button>

            <button
              type="button"
              className="pj-link"
              onClick={() => { setStep('phone'); setError(''); setOtpValue(''); }}
            >
              שנו מספר טלפון
            </button>
          </>
        )}
      </PremiumJoinShell>

      <LegalDrawer page={legalPage} onClose={() => setLegalPage(null)} />
    </MobileGuard>
  );
}
